import { Model, Column, Table, DataType, ForeignKey, BelongsTo, CreatedAt } from 'sequelize-typescript';

import { User } from './User';

@Table
export class Profile extends Model<Profile> {
	@Column
    dbid!: string;
    
    @Column
	captainName!: string;

	@Column
    sttAccessToken!: string;

	@Column
	lastUpdate!: Date;

    @Column(DataType.JSON)
    buffConfig!: any;

    @Column(DataType.JSON)
    shortCrewList!: any;

	@CreatedAt
    creationDate!: Date;

	@ForeignKey(() => User)
	@Column
	userId!: number;

	@BelongsTo(() => User)
	user!: User;
}
