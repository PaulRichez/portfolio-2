import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Experience {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  startDate: string;

  @Column()
  endDate: string;

  @Column()
  job: string;

  @Column()
  business: string;

  @Column()
  businessWebsite: string;

  @Column("simple-array")
  descriptions: string[];
}
