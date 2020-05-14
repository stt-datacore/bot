import fetch from 'node-fetch';
import { URLSearchParams } from 'url';

require('dotenv').config();

export interface IImgFlipEntry {
	id: string;
	name: string;
}

let cachedMemes: IImgFlipEntry[] = [];

export async function listMemesHardCoded(): Promise<IImgFlipEntry[]> {
	// Find more at https://imgflip.com/memesearch?q=star+trek&page=11
	return [
		{
			id: '208698065',
			name: 'BabyYoda'
		},
		{
			id: '20066716',
			name: 'Yes'
		},
		{
			id: '1509839',
			name: 'Facepalm'
		},
		{
			id: '245898',
			name: 'Wtf'
		},
		{
			id: '180118474',
			name: 'Disappointed'
		},
		{
			id: '138923047',
			name: 'OhNo'
		},
		{
			id: '67022837',
			name: 'Drink'
		},
		{
			id: '27325358',
			name: 'Khan'
		},
		{
			id: '18531605',
			name: 'Dammit'
		},
		{
			id: '4168895',
			name: 'DoubleFacepalm'
		},
		{
			id: '20087122',
			name: 'Data'
		},
		{
			id: '74331392',
			name: 'DataTricorder'
		},
		{
			id: '51039330',
			name: 'Scotty'
		},
		{
			id: '24116186',
			name: 'Spock'
		},
		{
			id: '16351930',
			name: 'Sulu'
		},
		{
			id: '22081522',
			name: 'RedShirts'
		},
		{
			id: '55537409',
			name: 'KirkMouth'
		},
		{
			id: '26994311',
			name: 'Touching'
		},
		{
			id: '72719816',
			name: 'Worf'
		},
		{
			id: '152256431',
			name: 'Tribbles'
		},
		{
			id: '73344775',
			name: 'Sisko'
		},
		{
			id: '201141573',
			name: 'JadziaAngry'
		}
	];
}

export async function listMemesTop100(): Promise<IImgFlipEntry[]> {
	if (cachedMemes.length > 1) {
		return cachedMemes;
	}

	let response = await fetch(`https://api.imgflip.com/get_memes`);
	if (response.ok) {
		let data = await response.json();

		if (data.success) {
			cachedMemes = data.data.memes;
			return cachedMemes;
		} else {
			throw new Error(data.error_message);
		}
	} else {
		throw new Error(`Could not connect to imgflip.com`);
	}
}

export async function captionMeme(template_id: string, captions: string[]) {
	let qs = new URLSearchParams();
	qs.append('template_id', template_id);
	qs.append('username', process.env.IMGFLIP_USERNAME!);
	qs.append('password', process.env.IMGFLIP_PASSWORD!);
    captions.forEach((caption, idx) => {
        qs.append(`boxes[${idx}][text]`, caption);
    })

	let response = await fetch(`https://api.imgflip.com/caption_image`, {
		method: 'POST',
		body: qs
	});

	if (response.ok) {
		let data = await response.json();

		if (data.success) {
			return data.data.url;
		} else {
			throw new Error(data.error_message);
		}
	} else {
		throw new Error(`Could not connect to imgflip.com`);
	}
}
