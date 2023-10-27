import { ObjectId } from "mongodb";
import {
  ITrackedAssignment,
  ITrackedVoyage,
  IVoyageHistory,
} from "../datacore/voyage";

export interface ITrackedVoyageRecord {
    dbid: number;
    trackerId: number;
    voyage: ITrackedVoyage;
    timeStamp: Date;
}

export interface ITrackedCrewRecord {
    dbid: number;
    crew: string;
    trackerId: number;
    assignment: ITrackedAssignment;
    timeStamp: Date; 
}

export interface ITrackedDataRecord {
    voyages: ITrackedVoyageRecord[];
    crew: ITrackedCrewRecord[];
}

export class TrackedVoyage implements ITrackedVoyageRecord {
  constructor(
    public dbid: number,
    public trackerId: number,
    public voyage: ITrackedVoyage,
    public timeStamp: Date = new Date(),
    public id?: ObjectId
  ) {}
}

export class TrackedCrew implements ITrackedCrewRecord {
  constructor(
    public dbid: number,
    public crew: string,
    public trackerId: number,
    public assignment: ITrackedAssignment,
    public timeStamp: Date = new Date(),
    public id?: ObjectId
  ) {}
}
