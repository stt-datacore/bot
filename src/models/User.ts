import { Model, Column, Table, Default, AllowNull, DataType, CreatedAt, HasMany } from 'sequelize-typescript';

import { Profile } from './Profile';

export enum UserRole {
    NORMAL = 'normal',
    DISCORDONLY = 'discordonly',
    STTLOGIN = 'sttlogin',
    BOOKEDITOR = 'bookeditor',
    ADMIN = 'admin'
}

@Table
export class User extends Model<User> {
	@Column
	discordUserName!: string;

	@Column
	discordUserDiscriminator!: string;

	@Column
	discordUserId!: string;

    @HasMany(() => Profile)
    profiles!: Profile[];

    @Default(UserRole.NORMAL)
    @AllowNull(false)
    @Column({
        type: DataType.ENUM(UserRole.NORMAL, UserRole.DISCORDONLY, UserRole.STTLOGIN, UserRole.BOOKEDITOR, UserRole.ADMIN)
    })
    userRole!: string;

	@CreatedAt
    creationDate!: Date;

    @Column(DataType.TEXT)
	avatar!: string;
}
