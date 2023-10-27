import * as mongoDB from "mongodb";

export const collections: { 
    profiles?: mongoDB.Collection;
    trackedVoyages?: mongoDB.Collection;
    trackedAssignments?: mongoDB.Collection;
    solves?: mongoDB.Collection;
    trials?: mongoDB.Collection;
    bossBattles?: mongoDB.Collection;
    users?: mongoDB.Collection;
    mongoAvailable?: boolean;
} = {}
// test gittower
require('dotenv').config();

export async function connectToMongo() {
    
    try {
        const client: mongoDB.MongoClient = new mongoDB.MongoClient(process.env.MONGO_CONN_STRING as string);
        await client.connect();
        
        const db: mongoDB.Db = client.db(process.env.MONGO_DB_NAME);
       
        const profilesCollection: mongoDB.Collection = db.collection(process.env.MONGO_PROFILE_COLLECTION as string);
        const trackedVoyagesCollection: mongoDB.Collection = db.collection(process.env.MONGO_TRACKED_VOYAGES_COLLECTION as string);
        const trackedAssignmentsCollection: mongoDB.Collection = db.collection(process.env.MONGO_TRACKED_ASSIGNMENTS_COLLECTION as string);
        const solves: mongoDB.Collection = db.collection(process.env.MONGO_FBB_SOLVES_COLLECTION as string);    
        const trials: mongoDB.Collection = db.collection(process.env.MONGO_FBB_TRIALS_COLLECTION as string);    
        const fbb: mongoDB.Collection = db.collection(process.env.MONGO_FBB_COLLECTION as string);    
        const users: mongoDB.Collection = db.collection(process.env.MONGO_DISCORD_USERS_COLLECTION as string);    

        collections.users = users;
        collections.users.createIndex("discordUserName");
        collections.users.createIndex("discordUserId");
        collections.users.createIndex("discordUserDiscriminator");

        collections.profiles = profilesCollection;
        collections.profiles.createIndex("dbid");
        collections.profiles.createIndex("dbidHash");
        collections.profiles.createIndex("fleet");
        collections.profiles.createIndex("squadron");
    
        collections.trackedVoyages = trackedVoyagesCollection;    
        
        collections.trackedVoyages.createIndex("dbid");
        collections.trackedVoyages.createIndex("trackerId");
    
        collections.trackedAssignments = trackedAssignmentsCollection;    
        
        collections.trackedAssignments.createIndex("dbid");
        collections.trackedAssignments.createIndex("crew");
        collections.trackedAssignments.createIndex("trackerId");
    
        collections.solves = solves;
        collections.solves.createIndex("bossBattleId");
        collections.solves.createIndex("chainIndex");

        collections.trials = trials;
        collections.trials.createIndex("bossBattleId");
        collections.trials.createIndex("chainIndex");

        collections.bossBattles = fbb;
        collections.bossBattles.createIndex("bossBattleId");
        collections.bossBattles.createIndex({
            bossBattleId: 1,
            fleetId: 1,
            difficultyId: 1
        });

        console.log(`Successfully connected to MongoDB database: ${db.databaseName}`);  
        Object.entries(collections).forEach(([key, col]) => {
            if (typeof col === 'boolean') return;
            console.log(` - Collection: ${col.collectionName}`);
        });
        
        return true;
    }
    catch(err) {
        console.log("Connection to MongoDB did not succeed!");
        console.log(err);
    }

    return false;

 }