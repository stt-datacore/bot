
import { CommandInteraction, GuildMember, Message, EmbedBuilder, MessageReplyOptions, User, GuildChannel, NonThreadGuildBasedChannel, Embed, MessageFlags, APIUser } from 'discord.js';
import NodeCache from 'node-cache';

export function getEmoteOrString(message: Message | CommandInteraction, emojiName: string, defaultString: string): string {
	//
	// Old Code
	//		
	//if (message instanceof CommandInteraction) {		
		// if (message.guild && !message.guild.roles.everyone.permissionsIn(message.channel! as NonThreadGuildBasedChannel).has('UseExternalEmojis')) {
		// 	let emoji = message.guild.emojis.cache.find(emoji => emoji.name === emojiName);
		// 	if (emoji) {
		// 		return emoji.toString();
		// 	}
		// }
	//}

	// New code addresses github issues:
	
	// https://github.com/discord/discord-api-docs/issues/5524
	// https://github.com/discord/discord-api-docs/issues/5279

	// Cannot seem to sync external emoji on bots, right now.
	// This bug has been opened for over a year (with no current resolutions)
	
	// Instead of checking if there are any guild permissions for external emoji
	// Just use this server's emoji by default, if available.
	if (message.guild) {
		let emoji = message.guild.emojis.cache.find(emoji => emoji.name === emojiName);
		if (emoji) {
			return emoji.toString();
		}
	}

	
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
	let myReply = await message.channel.send('```\n' + content + '```\n');

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

export function discordUserFromMessage(message: Message | CommandInteraction): APIUser | User | null | undefined {
	let user: User | APIUser | null | undefined = null;
	if (message instanceof Message)
		user = message.author;
	else if (message instanceof CommandInteraction) {
		if (message.user !== null)
			user = message.user;
		else if (message.member instanceof GuildMember)
			user = message.member.user;
		else
			user = message.member?.user as APIUser;
	}
	return user;
}

type SendOptions = {
	asReply?: boolean
	ephemeral?: boolean
	isFollowUp?: boolean
	embeds?: EmbedBuilder[]
}

export async function sendAndCache(message: Message | CommandInteraction, content: string, options?: SendOptions) {

	// Slash Commands have their own flow.
	if (message instanceof CommandInteraction) {

		let flags = options?.ephemeral ? MessageFlags.Ephemeral : 0; // { ephemeral: options?.ephemeral, embeds: options?.embeds?.splice(0,10) };
		if (options?.isFollowUp)
			message.followUp({ content, flags, embeds: options?.embeds?.splice(0,10)?.map((e) => e.toJSON()) })
		else
			message.reply({ content, flags, embeds: options?.embeds?.splice(0,10)?.map((e) => e.toJSON()) })
		while ((options?.embeds?.length ?? 0) > 0){
			let msg = { ephemeral: options?.ephemeral, embeds: options?.embeds?.splice(0,10)?.map((e) => e.toJSON()) };
			message.followUp(msg);
		}
		return;
	}
	
	let flags: MessageReplyOptions = {};
	
	flags.content = content;

	let nEmbeds = options?.embeds?.length ?? 0;

	if (nEmbeds > 0) {
		flags.embeds = options?.embeds!.slice(0, 1)?.map((e) => e.toJSON());
	}
	
	if (options?.asReply || message.channel == null) {
		flags.content = content;
		cache(await message.reply(flags));
	} else {
		cache(await (message.channel as any).send(flags));
	}

	if (nEmbeds > 1) {
		for (let additionalEmbed of options!.embeds!.slice(1)){
			flags = { embeds: [additionalEmbed] };
			cache(await (message.channel as any).send(flags));
		}
	}

	function cache(replies: Message | Message[] | null) {
		if (!replies)
			return;
		if (replies instanceof Message) {
			replies = [replies];
		}
		replies.forEach(myReply => {
			let entries = MessageCache.get<string[]>(message.id);
			if (entries) {
				entries.push(myReply.id);
				MessageCache.set(message.id, entries);
			} else {
				MessageCache.set(message.id, [myReply.id]);
			}
		});
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
