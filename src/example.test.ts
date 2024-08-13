import { Entity, Filter, ManyToOne, MikroORM, PrimaryKey, Property } from '@mikro-orm/sqlite';

@Entity()
@Filter({ name: 'soft-delete', default: true, cond: { deletedAt: { $eq: null } } })
class User {

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

  @Property({ unique: true })
  email!: string;

  @Property({ nullable: true, type: 'timestamptz' })
  deletedAt?: Date;
}

@Entity()
class Submission {
  @PrimaryKey()
  id!: number;

  @Property()
  title!: string;

  @ManyToOne(() => User)
  user!: User;
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [User, Submission],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();

  const userA = orm.em.create(User, { name: 'User A', email: 'foo' });
  const userB = orm.em.create(User, { name: 'User B', email: 'bar' });
  const userC = orm.em.create(User, { name: 'User C', email: 'baz' });

  orm.em.create(Submission, { title: 'Submission A', user: userA });
  orm.em.create(Submission, { title: 'Submission B', user: userB });
  orm.em.create(Submission, { title: 'Submission C', user: userC });

  await orm.em.flush();
});

afterAll(async () => {
  await orm.close(true);
});

beforeEach(async () => {
  orm.em.clear();
});

test('basic CRUD example', async () => {
  const [subs, count] = await orm.em.findAndCount(Submission, {});

  expect(subs).toHaveLength(3);
  expect(count).toBe(3);
});

test('soft delete', async () => {
  const user = await orm.em.findOneOrFail(User, { email: 'foo' });
  user.deletedAt = new Date();
  await orm.em.flush();

  orm.em.clear();

  const [subs, count] = await orm.em.findAndCount(Submission, {});

  expect(subs).toHaveLength(2);
  expect(count).toBe(2);
});