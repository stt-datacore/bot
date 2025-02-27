import { Message, EmbedBuilder, ApplicationCommandOptionType } from 'discord.js';
import yargs from 'yargs';

import { DCData } from '../data/DCData';
import { formatSources, formatRecipe, appelate, getItemBonuses } from '../utils/items';
import { colorFromRarity, formatCollectionName, formatCurrentStatLine, formatSkillsStatsWithEmotes, formatStatLine } from '../utils/crew';
import { getEmoteOrString, sendAndCache } from '../utils/discord';
import CONFIG from '../utils/config';
import { applyCrewBuffs, loadFullProfile, loadProfile, toTimestamp, userFromMessage } from '../utils/profile';
import { getNeededItems } from '../utils/equipment';
import { PlayerCrew } from '../datacore/player';
import { EquipmentItem } from '../datacore/equipment';
import { rarityLabels } from '../datacore/game-elements';
import { getOnlyAlpha } from '../utils';
import { Definitions } from '../utils/definitions';

function bonusName(bonus: string) {
	let cfg = CONFIG.STATS_CONFIG[Number.parseInt(bonus)];
	if (cfg) {
		return `${CONFIG.SKILLS[cfg.skill as Definitions.SkillName]} ${cfg.stat}`;
	} else {
		return `*unknown (${bonus})*`;
	}
}

async function asyncHandler(
	message: Message,
	crewman?: string
) {
	// This is just to break up the flow and make sure any exceptions end up in the .catch, not thrown during yargs command execution
	await new Promise<void>(resolve => setImmediate(() => resolve()));

	let user = await userFromMessage(message);
    let settings = user?.profiles[0] ? await loadProfile(user.profiles[0].dbid) : null;
	let profile = user?.profiles[0] ? loadFullProfile(user.profiles[0].dbid) : null;
    let dnum = 0;
    let origStr = "";

	if (!user || !profile) {
		sendAndCache(message, "Sorry, I couldn't find an associated profile for your user.")
		return;
	}
    else {
        dnum = new Date(new Date(profile.calc.lastImported).toUTCString()).getTime() / 1000;
    }
    if (crewman?.length) {
        origStr = crewman.trim();
        crewman = getOnlyAlpha(crewman).toLowerCase();
    }

	let botCrew = DCData.getBotCrew();
    let quipment = DCData.getItems().filter((item: Definitions.Item) => item.type === 15 || item.type === 14);

	let profileCrew = profile.player.character.crew;
	let captainName = profile.player.character.display_name;

	let quippedCrew = profileCrew.filter((c: PlayerCrew) => {
        if (!!c.kwipment?.length) {
            if (crewman?.length) {
                let bcrew = botCrew.find(f => f.symbol===c.symbol);
                if (!bcrew) return false;
                if (!getOnlyAlpha(bcrew.name).toLowerCase().includes(crewman)) return false;
            }
            c.kwipment_items = (c.kwipment.map(kw => quipment.find(q => q.kwipment_id?.toString() === kw[1].toString()))?.filter(chk => !!chk) ?? []) as Definitions.Item[];
            return true;
        }
        else {
            return false;
        }
	})
    .map((crew: PlayerCrew) => {
        let matched = botCrew.find((crew) => {
			return crew.symbol === crew.symbol
		}) as Definitions.BotCrew;

        crew = JSON.parse(JSON.stringify(crew));

        if (dnum)
            crew.kwipment_expirations = (crew.kwipment_expiration.map(kw => new Date((dnum+kw[1]) * 1000))?.filter(chk => !!chk) ?? []) as Date[];

        crew.name = matched?.name ?? crew.name;
        if (matched) {
            crew.bigbook_tier = matched?.bigbook_tier ?? -1;
            crew.cab_ov = matched?.cab_ov;
            crew.cab_ov_grade = matched?.cab_ov_grade;
            crew.cab_ov_rank = matched?.cab_ov_rank;
        }
        crew.bigbook_tier ??= -1;
        crew.date_added = new Date(crew.date_added);
        if (settings) crew.base_skills = applyCrewBuffs(crew.base_skills, settings.buffConfig);

        return crew;
    })
	.sort((a: PlayerCrew, b: PlayerCrew) => {
		let r = 0;
		if (!r) r = (b.kwipment_items?.length ?? 0) - (a.kwipment_items?.length ?? 0);
        if (!r) r = (b.max_rarity - a.max_rarity);
        //if (!r) r = (a.bigbook_tier - b.bigbook_tier);
        if (!r) r = (Number(b.cab_ov_rank) - Number(a.cab_ov_rank));
        if (!r) r = a.symbol.localeCompare(b.symbol);
		return r;
	});
    if (!quippedCrew?.length) {
        if (crewman){
            sendAndCache(message, `Couldn't find any quipped crew in your profile that matches '${origStr}'. If you think this is a mistake, please update your profile, and try again.`)
		    return;
        }
        else {
            sendAndCache(message, "Couldn't find any quipped crew in your profile. If you think this is a mistake, please update your profile, and try again.")
		    return;
        }
    }
    const embeds = [] as EmbedBuilder[];

    if (!crewman) {
        let p = 1;
        while (quippedCrew.length) {

            let embed = new EmbedBuilder()
            .setTitle(`Quipped Crew, Part ${p++}`)
            .setDescription(`Quipped Crew for **${captainName}'s** Roster (Updated ${toTimestamp(new Date(profile?.playerData?.calc?.lastImported ?? new Date()), 'D')})`)
            .setColor('DarkGreen')

            quippedCrew.splice(0, 10).forEach((can: PlayerCrew) => {
                const matched = botCrew.find((crew) => {
                    return crew.symbol === can.symbol
                }) as Definitions.BotCrew;

                if (!matched) {
                    return;
                }
                embed=embed.addFields({
                    name: `${matched.name}`,
                    value: ((can.rarity ? '⭐'.repeat(can.rarity ?? 0) : '')) + '\n' + formatSkillsStatsWithEmotes(message, can.skills)
                });
            });

            embeds.push(embed);
        }

        if (embeds.length === 1) {
            embeds[0] = embeds[0].setTitle('Quipped Crew');
        }
        embeds[embeds.length - 1] = embeds[embeds.length - 1].setFooter({text: 'Use -d quip or /quip <crew name> to get detailed stats'});

    }
    else {
        quippedCrew.forEach((can: PlayerCrew) => {
            const matched = botCrew.find((crew) => {
                return crew.symbol === can.symbol
            }) as Definitions.BotCrew;

            if (!matched) {
                return;
            }

            let embed = new EmbedBuilder()
                .setTitle(`${matched.name}`)
                .setDescription(`Current Quipment`)
                .setThumbnail(`${CONFIG.ASSETS_URL}${matched.imageUrlPortrait}`)
                .setColor(colorFromRarity(matched.max_rarity))
                .addFields(
                    {
                        name: `Immortalized Stats`,
                        value: formatCurrentStatLine(message, { ... matched, ...can }),
                        inline: false
                    },
                    {
                        name: `Quipped Stats`,
                        value: formatSkillsStatsWithEmotes(message, can.skills),
                        inline: false
                    }
                )

            if (can.kwipment_items?.length) {
                if (!!crewman) {
                    embeds.push(embed);
                    let e = 0;
                    for (let quip of can.kwipment_items) {
                        let b = getItemBonuses(quip as EquipmentItem).bonuses as Definitions.Skills;
                        let exp = (can.kwipment_expirations && can.kwipment_expiration.length > e) ? toTimestamp(can.kwipment_expirations[e]) : "N/A";
                        e++;

                        embed = new EmbedBuilder()
                            .setTitle(`${quip.name}`)
                            .setDescription(quip.flavor)
                            .setThumbnail(`${CONFIG.ASSETS_URL}${quip.imageUrl}`)
                            .setColor(colorFromRarity(quip.rarity))

                        embed = embed.addFields(                        {
                                name: `Buffs`,
                                value: formatSkillsStatsWithEmotes(message, b),
                                inline: false
                            },
                            {
                                name: "Rarity",
                                value: ((quip.rarity ? '⭐'.repeat(quip.rarity ?? 0) : '')),
                                inline: true
                            },
                            {
                                name: "Duration",
                                value: `${quip.duration} h`,
                                inline: true
                            },
                            {
                                name: "Expires On",
                                value: `${exp}`,
                                inline: true
                            },
                            {
                                name: "Equippable By",
                                value: `${rarityLabels[(quip.max_rarity_requirement ?? 1) - 1]} crew`,
                                inline: true
                            });
                        if (quip.traits_requirement?.length) {
                            embed = embed.addFields({
                                name: 'Required Traits',
                                value: `${quip.traits_requirement?.map(t => appelate(t)).join(` ${quip.traits_requirement_operator} `)}`,
                                inline: false
                            });
                        }
                        embeds.push(embed);
                    }
                }
                // else {
                //     let e = 0;
                //     for (let quip of can.kwipment_items) {
                //         let exp = (can.kwipment_expirations && can.kwipment_expiration.length > e) ? toTimestamp(can.kwipment_expirations[e]) : "N/A";
                //         e++;

                //         let b = getItemBonuses(quip as EquipmentItem).bonuses as Definitions.Skills;

                //         embed = embed.addFields({
                //             name: quip.name,
                //             value: ((quip.rarity ? '⭐'.repeat(quip.rarity ?? 0) : '')) + formatSkillsStatsWithEmotes(message, b) + `\nDuration: ${quip.duration} h (Expires on ${exp})` +
                //                 ((!!quip.traits_requirement?.length) ? `\nTraits: ${quip.traits_requirement?.map(t => appelate(t)).join(` ${quip.traits_requirement_operator} `)}` : '') +
                //                 `\nEquippable by ${rarityLabels[(quip.max_rarity_requirement ?? 1) - 1]} crew`

                //         })
                //     }
                //     embeds.push(embed);
                // }
            }


        });
    }

    sendAndCache(message,
        `Currently quipped crew in **${user.profiles[0].captainName}**'s roster (last updated ${toTimestamp(profile.lastModified ?? user.profiles[0].lastUpdate)})`,
        { embeds }
        );

}

class Quipment implements Definitions.Command {
	name = 'quip';
	command = 'quip [crew]';
	aliases = [];
	describe = 'Shows currently quipped crew';
	options = [{
			name: 'crew',
			type: ApplicationCommandOptionType.String,
			description: 'show quipment stats for the specified crew',
			required: false
		}]

	builder(yp: yargs.Argv): yargs.Argv {
		return yp.option('crew', {
			alias: 'c',
			desc: 'show quipment stats for the specified crew'
		});
	}

	handler(args: yargs.Arguments) {
		let message = <Message>args.message;
		let crew = args.crew as string;
		args.promisedResult = asyncHandler(message, crew);
	}
}

export let QuipmentCommand = new Quipment();
