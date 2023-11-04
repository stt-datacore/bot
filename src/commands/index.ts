import { FarmCommand } from './farm';
import { PingCommand } from "./ping";
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
import { OffersCommand } from './offers';
import { CheapestFFFECommand } from './cheapestfffe';
import { QuipmentCommand } from './quip';
import { SetDefaultCommand } from './setdefault';

export let Commands: Definitions.Command[] = [
	AssociateCommand,
	BeholdCommand,
	BestCommand,
	CheapestFFFECommand,
	CrewNeedCommand,
	DilemmaCommand,
	FarmCommand,
	GauntletCommand,
	MemeCommand,
	OffersCommand,
	PingCommand,
	ProfileCommand,
	ResetProfileCommand,
	SearchCommand,
	StatsCommand,
	VoyTimeCommand,
	SetDefaultCommand,
	QuipmentCommand
];
