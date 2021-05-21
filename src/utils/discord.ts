import { Message } from 'discord.js';
import NodeCache from 'node-cache';

export function getEmoteOrString(message: Message, emojiName: string, defaultString: string): string {
	switch (emojiName) {
		case 'credits':
			return '<:credits:835521627944124416>';
		case 'chrons':
			return '<:chrons:730399914005102623>';	
		case 'dil':
			return '<:dil:730399914332389446>';
		case 'honor':
			return '<:honor:730399914592567368>';
		case 'shuttle':
			return '<:shuttle:835521637612257321>';
		case 'cmd':
			return '<:cmd:730399913413967963>';
		case 'dip':
			return '<:dip:730399914269474946>';
		case 'eng':
			return '<:eng:730399913707438181>';
		case 'med':
			return '<:med:730399913799581777>'; 
		case 'sci':
			return '<:sci:730399914449961030>';
		case 'sec':
			return '<:sec:730399914349297785>';
		default:
			// We call this function for Ship abilities (attack,evasion,accuracy,shield regen) 
			// but we don't have any emoji for them, so they always fallback to text.
			return defaultString;
	}
}

export let MessageCache = new NodeCache({ stdTTL: 600 });

export async function sendSplitText(message: Message, content: any) {
	let myReply = await message.channel.send(content, {
		split: {
			prepend: '```\n',
			append: '```\n'
		}
	});

	if (myReply instanceof Message) {
		let entries = MessageCache.get<string[]>(message.id);
		if (entries) {
			entries.push(myReply.id);
			MessageCache.set(message.id, entries);
		} else {
			MessageCache.set(message.id, [myReply.id]);
		}
	}
}

export async function sendAndCache(message: Message, content: any, asReply: boolean = false) {
	let myReply;

	if (asReply) {
		myReply = await message.reply(content);
	} else {
		myReply = await message.channel.send(content);
	}

	if (myReply instanceof Message) {
		let entries = MessageCache.get<string[]>(message.id);
		if (entries) {
			entries.push(myReply.id);
			MessageCache.set(message.id, entries);
		} else {
			MessageCache.set(message.id, [myReply.id]);
		}
	}
}

export async function deleteOldReplies(message: Message, titleToDelete: string) {
	let messages = await message.channel.messages.fetch({ limit: 100 });

	for (let msg of messages.values()) {
		if (msg.author.id === message.client?.user?.id) {
			// This is one of the bot's old messages
			if (msg.embeds && msg.embeds.length > 0) {
				if (msg.embeds[0].title === titleToDelete) {
					try {
						await msg.delete();
					} catch {
						// Ok to ignore
					}
				}
			}
		}
	}
}
