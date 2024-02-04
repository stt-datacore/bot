import { Message, EmbedBuilder } from "discord.js";
import { DCData } from "../data/DCData";
import { PlayerData } from "../datacore/player";
import { Schematics } from "../datacore/ship";
import CONFIG from "./config";
import { colorFromRarity, formatTrait } from "./crew";
import { sendAndCache } from "./discord";
import { userFromMessage, loadFullProfile } from "./profile";
import { shipSum } from "./ships";

export async function handleShipBehold(message: Message, beholdResult: any, fromCommand: boolean, base: boolean) {

	let allSchematics = DCData.getSchematics();
	let results = [beholdResult.crew1, beholdResult.crew2, beholdResult.crew3];
	let ships = results.map(r => allSchematics.find(f => f.ship.model === r.symbol)).filter(s => s !== undefined).map(s => (s as Schematics).ship);

	if (ships.length === 3) {
		let embed = new EmbedBuilder()
		.setTitle('Detailed comparison')
		.setColor(colorFromRarity(ships[0].rarity));

		let customranks = ['', '', ''];

		if (!base) {
			let user = await userFromMessage(message);
			if (user && user.profiles.length > 0) {
				// Apply personalization
				let fullProfile = loadFullProfile(user.profiles[0].dbid) as PlayerData;
				let ownedShips = fullProfile.player.character.ships.filter(f => results.some(r => r.symbol === f.model));
				let unownedShips = fullProfile.player.character.ships.filter(f => !results.some(r => r.symbol === f.model));

				for (let ship of ownedShips) {
					let shipresult = ships.find(f => f.symbol === ship.symbol);
					if (shipresult) {
						shipresult.level = ship.level;
						shipresult.schematic_gain_cost_next_level = ship.schematic_gain_cost_next_level;
						shipresult.owned = true;
						shipresult.score = shipSum(shipresult);
					}
				}

				for (let ship of unownedShips) {
					let shipresult = ships.find(f => f.symbol === ship.symbol);
					if (shipresult) {
						shipresult.level = 0;
						shipresult.schematic_gain_cost_next_level = ship.schematic_gain_cost_next_level;
						shipresult.owned = false;
						shipresult.score = shipSum(shipresult);
					}
				}				
			}
			else {
				for (let shipresult of ships) {
					shipresult.level = 0;
					shipresult.schematic_gain_cost_next_level = 0;
					shipresult.owned = false;
					shipresult.score = shipSum(shipresult);
				}
			}

			let protobest = [...ships];
			protobest.sort((a, b) => {
				let r = (b.score ?? 0) - (a.score ?? 0);					
				if (a.level === a.max_level && b.level === b.max_level) {
					return r;
				}
				else if (a.level === a.max_level) {
					return 1;
				}
				else if (b.level === b.max_level) {
					return -1;
				}
				else {
					return r;
				}
			});

			let best = protobest[0];
			let assetUrl = `${CONFIG.ASSETS_URL}${best.icon?.file.replace("ship_previews\/", "ship_previews_")}.png`;

			embed = embed
					.setThumbnail(assetUrl)
					.setDescription(`**${best.name ?? ''}** is your best bet.`)
			
			if (user) {
				embed = embed.addFields({
					name: user.profiles[0].captainName,
					value: `Stats are customized for [your profile](${CONFIG.DATACORE_URL}profile/?dbid=${user.profiles[0].dbid})'s schematics`
				});
			}

			for (let ship of ships) {
				let embedtext = "";
				
				if (ship.owned) {
					embedtext += `${ship.level}/${ship.max_level}\n`;
				}
				else if (user && user.profiles.length > 0) {
					embedtext += `Unowned/${ship.max_level}`;
				}
				else {
					embedtext += `${ship.max_level}`;
				}

				//embedtext += `Score: ${ship.score?.toLocaleString()}\n`;
				//embedtext += `${ship.flavor ?? ''}`;

				embed = embed.addFields({ 
					name: ship.name ?? ship.symbol, 
					value: ship.flavor ?? ''
				});
				embed = embed.addFields({ 
					name: 'Score', 
					value: `${Math.round((ship.score ?? 0) / 10000)}`,
					inline: true
				});

				embed = embed.addFields({ 
					name: 'Level', 
					value: embedtext,
					inline: true
				});
				embed = embed.addFields({ 
					name: 'Traits', 
					value: ship.traits?.map(t => formatTrait(t)).join(", ") ?? '',
					inline: true
				});
				embed = embed.addFields({ 
					name: 'Attack', 
					value: `${ship.attack}`,
					inline: true
				});
				embed = embed.addFields({ 
					name: 'Accuracy', 
					value: `${ship.accuracy}`,
					inline: true
				});
				embed = embed.addFields({ 
					name: 'Evasion', 
					value: `${ship.evasion}`,
					inline: true
				});

				// for (let ability of ship.actions ?? []) {
				// 	if (ability.ability) {
				// 		embed = embed.addFields({ 
				// 			name: ability.ability_text ?? '', 
				// 			value: actionAbilityoString(ability.ability),
				// 			inline: true
				// 		});								
				// 	}
					
				// }
			}

			embed = embed.setFooter({
						text: customranks[0]
							? 'Make sure to re-upload your profile frequently to get accurate custom recommendations'
							: `Upload your profile to get custom recommendations`
					});

			sendAndCache(message, '', {embeds: [embed]});
			return true;
		}
	}

	return false;
}
