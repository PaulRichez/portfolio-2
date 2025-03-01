import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Diploma {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column()
  title: string;

  @Column()
  description: string;
}
