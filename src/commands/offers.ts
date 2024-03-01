import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';
import fetch from 'node-fetch';
import NodeCache from 'node-cache';

import { DCData } from '../data/DCData';
import { sendAndCache } from '../utils/discord';

import CONFIG from '../utils/config';
import { Logger } from '../utils';
import { formatCrewField } from '../utils/beholdcalc';
import { userFromMessage, loadProfile, loadProfileRoster, ProfileRosterEntry } from '../utils/profile';


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

async function asyncHandler(message: Message, offer_name?: String, needed?: boolean) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));
	
	const maxOffer = 6;

	let offers: any = undefined; 
	
	try {
		offers = await loadOffers();
	}
	catch (err: any) {
		console.log(err);
	}
	
	if (!offers) {
		sendAndCache(message, "We are having trouble retrieving offers, right now. Please wait at least 10 seconds, and try again.");
		return;
	}

	//console.log(offers);

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
	
	let embeds = [];
	let remainder = [] as Definitions.BotCrew[];
	let pricrew = [] as Definitions.BotCrew[];	
	let part = 1;
	let roster = [] as ProfileRosterEntry[];

	if (needed){
		let user = await userFromMessage(message);		
		if (user && user.profiles.length > 0) {
			// Apply personalization			
			let profile = await loadProfile(user.profiles[0].dbid);		
			if (profile) {
				roster = loadProfileRoster(profile) ?? [];
				
			}
		}
	}

	relevantCrew = relevantCrew.sort((a, b) => (b.date_added as Date).getTime() - (a.date_added as Date).getTime())
		.filter(f => !roster.length || !roster.some(r => r.crew.symbol === f.symbol) || !roster.every(r => (f.symbol === r.crew.symbol && r.rarity >= r.crew.max_rarity) || (f.symbol !== r.crew.symbol)));
	
	pricrew = relevantCrew.splice(0, maxOffer);
	let andmore = relevantCrew.length;		
	relevantCrew = relevantCrew.splice(0, 20);
	andmore -= relevantCrew.length;

	while (!!pricrew?.length) {
		let embed = new EmbedBuilder()
			.setThumbnail(CONFIG.ASSETS_URL + pricrew[0].imageUrlPortrait)
			.setTitle(`Crew details for offer: ${selectedOffer.primary_content[0].title} (Part ${part++})`)
			.setURL(`${CONFIG.DATACORE_URL}crew/${pricrew[0].symbol}`);
		pricrew.splice(0, 1).forEach((crew) => {
			embed.addFields({ name: crew.name, value: formatCrewField(message, crew, crew.max_rarity, '', crew?.collections ?? []) });
		});		
		
		embeds.push(embed);
	}
	while (relevantCrew.length) {
		let embed = new EmbedBuilder()
			.setTitle(`Crew details for offer: ${selectedOffer.primary_content[0].title} (Part ${part++})`);
		let s = "";
		let i = 0;
		
		while (i < relevantCrew.length) {
			let crew = relevantCrew[i];
			let str = `[${crew.name}](${CONFIG.DATACORE_URL}crew/${crew.symbol})`;
			if (s.length + str.length + 2 > 900) {
				break;
			}
			if (s != "") s += ", ";
			s += str;
			i++;				
		}

		relevantCrew.splice(0, i);
		embed.addFields({ name: 'Crew', value: s });			
		embeds.push(embed);
	}

	if (andmore > 0 && embeds[embeds.length - 1].data.fields?.length) {
		let datafield = embeds[embeds.length - 1].data.fields ?? []
		datafield[datafield.length - 1].value += ", and " + andmore.toString() +" more ...";
	}

	let content = embeds.length ? '' : `No needed crew found in offer '${selectedOffer.primary_content[0].title}'.`;
	sendAndCache(message, content, { embeds });

	return;
}

class Offers implements Definitions.Command {
	name = 'offers';
	command = 'offers [offer_name..] [--needed true|false]';
	aliases = ['offer'];
	describe = 'Lists current offers available in the portal or details of an offer';
	options = [
		{
			name: 'offer_name',
			type: ApplicationCommandOptionType.String,
			description: "name of the offer to show details of",
			required: false,
		},
		{
			name: 'needed',			
			type: ApplicationCommandOptionType.Boolean,
			description: "show only crew from offers that are unowned or fusable",
			required: false,
			default: false
		}
	];
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('offer_name', {
				describe: 'name of the offer to show details of',
				type: 'string'
			})
			.option('needed', {
				alias: "n",
				describe: "show only crew from offers that are unowned or fusable",
				type: 'boolean',
				default: false
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let offerName = <string[]>args.offer_name;
		let needed = <boolean>(args.needed ?? false);
		args.promisedResult = asyncHandler(message, typeof(offerName) === 'object' ? offerName.join(' ') : offerName, needed);
	}
}

export let OffersCommand = new Offers();
