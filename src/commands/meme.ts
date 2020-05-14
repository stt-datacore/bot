import { Message, RichEmbed } from 'discord.js';
import yargs from 'yargs';

import { captionMeme, listMemesTop100, listMemesHardCoded } from '../utils/imgflip';
import { sendAndCache } from '../utils/discord';

// TODO: load and cache listMemesTop100 on boot

async function asyncHandler(message: Message, name: string, texts: string[]) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise(resolve => setImmediate(() => resolve()));

    if (name === 'list') {
        let memes = await listMemesHardCoded();
        sendAndCache(message, `Available meme templates: ${memes.map(meme => meme.name).join(', ')}`)
    } else {
        // generate a meme
		let memes = await listMemesHardCoded();
		memes = memes.concat(await listMemesTop100());

        let mm = memes.find(meme => meme.name.toLowerCase().indexOf(name) >= 0);
        if (mm) {
            let url = await captionMeme(mm.id, texts);
            sendAndCache(message, new RichEmbed().setImage(url));

            // TODO: delete message if it has the rights
        } else {
            sendAndCache(message, `I couldn't find a meme template named '${name}'. Try **list** to see what's available.`)
        }
    }
}

class Meme implements Definitions.Command {
	name = 'meme';
	command = 'meme <name> [text..]';
	aliases = [];
	describe = 'Generate a meme image and post it';
	builder(yp: yargs.Argv): yargs.Argv {
		return yp
			.positional('name', {
				describe: "name of the meme; use list to see what's available"
			})
			.positional('text', {
				describe: 'lines of text. Enclose each line in quotes'
			});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;

        args.promisedResult = asyncHandler(message, (args.name as string).trim().toLowerCase(), <string[]>args.text);
	}
}

export let MemeCommand = new Meme();
