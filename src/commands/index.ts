import { FarmCommand } from './farm';
import { StatsCommand } from './stats';
import { BeholdCommand } from './behold';
import { SearchCommand } from './search';
import { VoyTimeCommand } from './voytime';
import { BestCommand } from './best';
import { DilemmaCommand } from './dilemma';
import { GauntletCommand } from './gauntlet';
import { MemeCommand } from './meme';
import { AssociateCommand } from './associate';
import { ResetProfileCommand } from './resetprofile';
import { ProfileCommand } from './profile';
import { CrewNeedCommand } from './crewneed';

export let Commands: Definitions.Command[] = [
	SearchCommand,
	StatsCommand,
	BestCommand,
	BeholdCommand,
	FarmCommand,
	VoyTimeCommand,
	DilemmaCommand,
	GauntletCommand,
	MemeCommand,
	AssociateCommand,
	ProfileCommand,
	ResetProfileCommand,
	CrewNeedCommand,
];
