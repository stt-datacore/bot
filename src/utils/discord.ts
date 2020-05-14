import { Message } from 'discord.js';
import NodeCache from 'node-cache';

export function getEmoteOrString(message: Message, emojiName: string, defaultString: string): string {
	if (message.guild) {
		let emoji = message.guild.emojis.find((emoji) => emoji.name === emojiName);
		if (emoji) {
			return emoji.toString();
		}
	}
	return defaultString;
}

export let MessageCache = new NodeCache({ stdTTL: 600 });

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
	let messages = await message.channel.fetchMessages({ limit: 100 });

	for (let msg of messages.values()) {
		if (msg.author.id === message.client.user.id) {
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
