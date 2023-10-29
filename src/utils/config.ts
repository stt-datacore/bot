require('dotenv').config();

export default class CONFIG {
	static readonly DATACORE_URL = process.env.DATACORE_URL;
	static readonly ASSETS_URL = process.env.ASSETS_URL;
	static readonly IMAGE_ANALYSIS_URL = 'http://localhost:5000';

	static readonly SKILLS: { [key in Definitions.SkillName]: string } = {
		command_skill: 'Command',
		science_skill: 'Science',
		security_skill: 'Security',
		engineering_skill: 'Engineering',
		diplomacy_skill: 'Diplomacy',
		medicine_skill: 'Medicine'
	};

	static readonly STATS_CONFIG: { [index: number]: any } = {
		2: { symbol: 'engineering_skill_core', skill: 'engineering_skill', stat: 'Core Skill' },
		3: { symbol: 'engineering_skill_range_min', skill: 'engineering_skill', stat: 'Skill Proficiency Min' },
		4: { symbol: 'engineering_skill_range_max', skill: 'engineering_skill', stat: 'Skill Proficiency Max' },
		6: { symbol: 'command_skill_core', skill: 'command_skill', stat: 'Core Skill' },
		7: { symbol: 'command_skill_range_min', skill: 'command_skill', stat: 'Skill Proficiency Min' },
		8: { symbol: 'command_skill_range_max', skill: 'command_skill', stat: 'Skill Proficiency Max' },
		14: { symbol: 'science_skill_core', skill: 'science_skill', stat: 'Core Skill' },
		15: { symbol: 'science_skill_range_min', skill: 'science_skill', stat: 'Skill Proficiency Min' },
		16: { symbol: 'science_skill_range_max', skill: 'science_skill', stat: 'Skill Proficiency Max' },
		18: { symbol: 'diplomacy_skill_core', skill: 'diplomacy_skill', stat: 'Core Skill' },
		19: { symbol: 'diplomacy_skill_range_min', skill: 'diplomacy_skill', stat: 'Skill Proficiency Min' },
		20: { symbol: 'diplomacy_skill_range_max', skill: 'diplomacy_skill', stat: 'Skill Proficiency Max' },
		22: { symbol: 'security_skill_core', skill: 'security_skill', stat: 'Core Skill' },
		23: { symbol: 'security_skill_range_min', skill: 'security_skill', stat: 'Skill Proficiency Min' },
		24: { symbol: 'security_skill_range_max', skill: 'security_skill', stat: 'Skill Proficiency Max' },
		26: { symbol: 'medicine_skill_core', skill: 'medicine_skill', stat: 'Core Skill' },
		27: { symbol: 'medicine_skill_range_min', skill: 'medicine_skill', stat: 'Skill Proficiency Min' },
		28: { symbol: 'medicine_skill_range_max', skill: 'medicine_skill', stat: 'Skill Proficiency Max' }
	};
}
