import { takeLatest, delay } from 'redux-saga';
import { put, call, cancelled } from 'redux-saga/effects';
import {
    queryParameters,
    fetchJson,
    FETCH_START,
    FETCH_END,
    FETCH_ERROR,
    FETCH_CANCEL,
} from '../../src/util/fetch';
import {
    CRUD_GET_LIST,
    CRUD_GET_ONE,
    CRUD_CREATE,
    CRUD_UPDATE,
    CRUD_DELETE,
} from '../../src/data/actions';

const root = 'http://localhost:3000';

const buildHttpRequest = (resource, type, payload) => {
    let url = '';
    const options = {};
    switch (type) {
    case CRUD_GET_LIST: {
        const { page, perPage } = payload.pagination;
        const { field, order } = payload.sort;
        const query = {
            sort: JSON.stringify([field, order]),
            range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
        };
        url = `${root}/${resource}?${queryParameters(query)}`;
        break;
    }
    case CRUD_GET_ONE:
        url = `${root}/${resource}/${payload.id}`;
        break;
    case CRUD_UPDATE:
        url = `${root}/${resource}/${payload.id}`;
        options.method = 'PUT';
        options.body = JSON.stringify(payload.data);
        break;
    default:
        throw new Error(`Unsupported fetch action type ${type}`);
    }
    return { url, options };
};

const convertResponse = (resource, type, response) => {
    const { headers, json } = response;
    switch (type) {
    case CRUD_GET_LIST:
        return {
            data: json.map(x => x),
            total: parseInt(headers['content-range'].split('/').pop(), 10),
        };
    default:
        return {
            data: json,
        };
    }
};

function *handleFetch(action) {
    const { type, payload, meta: { resource } } = action;
    yield [
        put({ ...action, type: `${type}_LOADING`, meta: { resource } }),
        put({ type: FETCH_START }),
    ];
    const { url, options } = buildHttpRequest(resource, type, payload);
    let response;
    try {
        // simulate response delay
        yield call(delay, 1000);
        response = yield fetchJson(url, options);
    } catch (error) {
        yield [
            put({ ...action, type: `${type}_FAILURE`, error, meta: { resource } }),
            put({ type: FETCH_ERROR }),
        ];
        return;
    } finally {
        if (yield cancelled()) {
            yield put({ type: FETCH_CANCEL });
            return;
        }
    }
    yield [
        put({ ...action, type: `${type}_SUCCESS`, payload: convertResponse(resource, type, response), meta: { resource } }),
        put({ type: FETCH_END }),
    ];
};

function *watchCrudFetch() {
    yield* takeLatest(action => action.meta && action.meta.fetch, handleFetch);
}

export default watchCrudFetch;
