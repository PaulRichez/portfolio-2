import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Knowledge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  key: string;
}
