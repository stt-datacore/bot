import fetch from 'node-fetch';
import CONFIG from './config';

export interface BeholdResultSection {
	symbol: string;
	score: number;
	stars: number;
}

export interface BeholdResult {
	input_width: number;
	input_height: number;
	top: BeholdResultSection;
	crew1: BeholdResultSection;
	crew2: BeholdResultSection;
	crew3: BeholdResultSection;
	error?: string;
	closebuttons: number;
}

export interface VoyageResultSection {
	SkillValue: number;
	Primary: number;
}

export interface VoyageResult {
	antimatter: number;
    valid: boolean;

    cmd: VoyageResultSection;
    dip: VoyageResultSection;
    eng: VoyageResultSection;
    sec: VoyageResultSection;
    med: VoyageResultSection;
    sci: VoyageResultSection;
}

export function getVoyParams(res: VoyageResult) {
    let otherskills: number[] = [];
    let primary = 0;
    let secondary = 0;

    const parseSkill = (sk: VoyageResultSection) => {
        if (sk.Primary === 1) {
            primary = sk.SkillValue;
        } else if (sk.Primary === 2) {
            secondary = sk.SkillValue;
        } else {
            otherskills.push(sk.SkillValue);
        }
    }

    parseSkill(res.cmd);
    parseSkill(res.dip);
    parseSkill(res.eng);
    parseSkill(res.sec);
    parseSkill(res.med);
    parseSkill(res.sci);

    return [primary, secondary].concat(otherskills);
}

export interface AnalysisResult {
    beholdResult?: BeholdResult;
    voyResult?: VoyageResult;
}

export async function analyzeImage(url: string): Promise<AnalysisResult | undefined> {
    // TODO: auto-deployments for the c# code
    try {
        let response = await fetch(`${CONFIG.IMAGE_ANALYSIS_URL}/api/behold?url=${encodeURIComponent(url)}`);
        if (response.ok) {
            return await response.json();
        }
    }
    catch (err: any) {
        console.log(err);
    }

    return undefined;
}
