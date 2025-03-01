import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class CodingSkill {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;

  @Column()
  value: number;
}
