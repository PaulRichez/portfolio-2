import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Me {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  lastName: string;

  @Column()
  firstName: string;

  @Column()
  city: string;

  @Column()
  birthDay: string;

  @Column()
  phoneNumber: string;

  @Column()
  email: string;

  @Column()
  postName: string;

  @Column()
  linkedin: string;

  @Column()
  github: string;

  @Column()
  website: string;
}
