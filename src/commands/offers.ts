import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';

import { DCData } from '../data/DCData';
import { sendAndCache } from '../utils/discord';

import CONFIG from '../utils/config';
import { Logger } from '../utils';
import { formatCrewField } from '../utils/beholdcalc';


let OffersCache = new NodeCache({ stdTTL: 600 });

async function loadOffers(): Promise<any> {
	let offersCached = OffersCache.get('G');
	if (offersCached) {
		return offersCached;
	}

	try {
		let response = await fetch(`${CONFIG.DATACORE_URL}api/offer_info`);
		console.log(response);
		if (response.ok) {
			let reply = await response.json();

			OffersCache.set('G', reply, Math.min(reply.seconds_to_join, 600));

			return reply;
		}
	} catch (err) {
		Logger.error('Error while loading offers info', err);
		return undefined;
	}
}

function getOfferList(offers: any) {
	return new Set(offers.map((o: any) => o.primary_content[0].title));
}

async function asyncHandler(message: Message, offer_name?: String) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let offers = await loadOffers();
	console.log(offers);

	if (!offer_name) {
		let offerList = getOfferList(offers);
		sendAndCache(message, `There are currently the following offers listed in the Time Portal:${['', ...offerList].join("\n * ")}`);
		return;
	}

	let selectedOffer = offers.find((o: any) => o.primary_content[0].title.toLowerCase().indexOf(offer_name.toLowerCase()) !== -1 );
	if (!selectedOffer) {
		sendAndCache(message, `Could not find an offer matching ${offer_name}`);
		return;
	}

	let relevantCrew = DCData.getBotCrew()
		.filter(crew => selectedOffer.primary_content[0].info_text.indexOf(`>${crew.name}<`) !== -1);
	if (relevantCrew.length === 0) {
		sendAndCache(message, `Could not find any crew for offer ${selectedOffer.primary_content[0].title}`)
		return;
	}
	let embed = new EmbedBuilder()
		.setTitle(`Crew details for offer: ${selectedOffer.primary_content[0].title}`);
	relevantCrew.forEach((crew) => {
		embed.addFields({ name: crew.name, value: formatCrewField(message, crew, crew.max_rarity, '', crew.collections) });
	});
	sendAndCache(message, '', {embeds: [embed]});
	return;
}

class Offers implements Definitions.Command {
	name = 'offers';
	command = 'offers [offer_name..]';
	aliases = ['offer'];
	describe = 'Lists current offers available in the portal or details of an offer';
	options = [
		{
			name: 'offer_name',
			type: ApplicationCommandOptionType.String,
			description: "name of the offer to show details of",
			required: false,
		}
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('offer_name', {
				describe: 'name of the offer to show details of',
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let offerName = <string[]>args.offer_name;
		args.promisedResult = asyncHandler(message, typeof(offerName) === 'object' ? offerName.join(' ') : offerName);
	}
}

export let OffersCommand = new Offers();
