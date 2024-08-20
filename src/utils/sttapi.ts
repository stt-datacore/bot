import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

// Code in this file adapted from IAmPicard's SttApi

class CONFIG {
	static readonly URL_PLATFORM: string = 'https://thorium.disruptorbeam.com/';
	static readonly URL_SERVER: string = 'https://app.startrektimelines.com/';
	static readonly CLIENT_API_VERSION: number = 24;
}

function _weirdUrlify(form: any): string {
    // Arrays on DB's severs don't work with the usual "ids=1,2", they need the special "ids[]=1&ids[]=2" form
    let searchParams: URLSearchParams = new URLSearchParams();
    for (const prop of Object.keys(form)) {
        if (Array.isArray(form[prop])) {
            form[prop].forEach((entry: any): void => {
                searchParams.append(prop + '[]', entry);
            });
        }
        else {
            searchParams.set(prop, form[prop]);
        }
    }

    return searchParams.toString();
}

async function get(uri: string, qs: any, json: boolean = true): Promise<any> {
    let response;
    if (qs) {
        response = await fetch(uri + "?" + _weirdUrlify(qs));
    } else {
        response = await fetch(uri);
    }

    if (response.ok) {
        if (json) {
            return response.json();
        } else {
            return response.text();
        }
    } else {
        let data = await response.text();
        throw new Error(`Network error; status ${response.status}; reply ${data}.`);
    }
}

export async function executeGetRequest(resourceUrl: string, access_token?: string, qs: any = {}): Promise<any> {
    if (!access_token) {
        // TODO: Use bot access_token for non-player requests
        throw new Error('Not logged in!');
    }

    return get(
        CONFIG.URL_SERVER + resourceUrl,
        Object.assign({ client_api: CONFIG.CLIENT_API_VERSION, access_token }, qs), true
    );
}
