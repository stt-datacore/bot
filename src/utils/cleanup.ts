import { ChannelType, Client, Guild } from "discord.js";




export function purgeGuilds(client: Client, purge: boolean) {
    console.log("Scanning guilds...");
    const rollDate = new Date();
    rollDate.setMonth(rollDate.getMonth() - 3);
    const oldGuilds = [] as [Date, Guild][];
    fetch(`https://discord.com/api/v9/users/@me/guilds`, {
        headers: {
            "Authorization": "Bot " + process.env.BOT_TOKEN
        }
    })
    .then(result => result.json())
    .then((data: Guild[]) => Promise.all(data.map((d) => client.guilds.fetch(d.id))))
    .then((data: Guild[]) => {
        const guilds = data;

        (async () => {
            for (let guild of guilds) {
                console.log(`Scanning ${guild.name}...`);
                let gts = null as Date | null;
                for (let [id, channel] of [...guild.channels.cache]) {
                    if (channel.type === ChannelType.GuildText) {
                        if (!channel.permissionsFor(client.user!)?.has('ReadMessageHistory')) continue;
                        try {
                            const messages = await channel.messages.fetch({ limit: 2 });
                            const msg = messages.last();
                            if (msg?.createdTimestamp) {
                                if (gts === null || gts.getTime() < msg.createdTimestamp) {
                                    gts = new Date(msg.createdTimestamp);
                                    if (gts.getTime() >= rollDate.getTime()) {
                                        gts = null;
                                        break;
                                    }
                                }
                            }
                        }
                        catch {
                            continue;
                        }
                    }
                }
                if (gts) {
                    console.log(`Last message: ${gts}`);
                    oldGuilds.push([gts, guild]);
                }
                if (!guild.available) {
                    console.log(`Guild ${guild.name} is not available.`)
                    //await guild.leave();
                }
            }

            if (oldGuilds.length) {
                for (let [date, guild] of oldGuilds) {
                    if (purge) {
                        console.log(`Leaving inactive guild: ${guild.name}\n(Last activity ${date.toLocaleDateString()}).\n`);
                        await guild.leave();
                    }
                    else {
                        console.log(`Identified inactive guild: ${guild.name}\n(Last activity ${date.toLocaleDateString()}).\n`);
                    }
                }

            }
            process.exit(0);
        })();
    })
    .catch((e) => console.log(e));
}