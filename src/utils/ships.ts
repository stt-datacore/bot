import { Ship } from "../datacore/ship";

const duration = 180;

export function shipSum(ship: Ship) {
    let sum = (ship.attack * 3) + (ship.accuracy * 2) + (ship.evasion * 1);
    sum = (ship.hull + (ship.crit_bonus + ship.crit_chance)) + sum;
    sum = sum + (ship.actions?.map(a => a.bonus_amount).reduce((p, n) => p + n, 0) ?? 0)
    return sum;
}

