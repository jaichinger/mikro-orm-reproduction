import {
  Entity,
  ManyToOne,
  MikroORM,
  OneToOne,
  PrimaryKey,
  PrimaryKeyProp,
  Property,
  ref,
  Ref,
} from '@mikro-orm/sqlite';

@Entity()
class Organisation {

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

}

export abstract class OrgEntity {

  [PrimaryKeyProp]?: ['org', 'id'];

  @ManyToOne(() => Organisation, {
    primary: true,
    fieldName: 'org_id',
    deleteRule: 'cascade',
    ref: true,
  })
  org!: Ref<Organisation>;

  @PrimaryKey()
  id!: number;

}

@Entity()
class Author extends OrgEntity {

  @Property()
  name!: string;

}

@Entity()
class Book extends OrgEntity {

  @Property()
  name!: string;

  @OneToOne({
    entity: () => Author,
    fieldNames: ['org_id', 'author_id'],
    ownColumns: ['author_id'],
    ref: true,
  })
  author!: Ref<Author>;

}

let orm: MikroORM;

const createTestData = async () => {
  const organisation = orm.em.create(Organisation, { id: 1, name: 'Org A' });

  const author1 = orm.em.create(Author, { id: 1, name: 'Author 1', org: ref(organisation) });
  const book1 = orm.em.create(Book, {
    id: 1,
    name: 'Book 1',
    org: ref(organisation),
    author: ref(author1),
  });
  await orm.em.flush();
};

beforeAll(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [Organisation, Author, Book, OrgEntity],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // for testing purposes
  });

  await orm.schema.refreshDatabase();
});

beforeEach(async () => {
  orm.em.clear();
  await orm.schema.clearDatabase();
  await createTestData();
});

afterAll(async () => {
  await orm.close(true);
});

test('simple test', async () => {
  const book = await orm.em.findOneOrFail(Book, {
    org: ref(Organisation, 1),
    id: 1,
  }, {
    populate: ['author'],
  });
  expect(book.name).toBe('Book 1');
  expect(book.author.$.name).toBe('Author 1');

  const author = await orm.em.findOneOrFail(Author, {
    org: ref(Organisation, 1),
    id: 1,
  });
  expect(author.name).toBe('Author 1');
  expect(author.org.id).toBe(1);

  orm.em.getUnitOfWork().computeChangeSets();
  expect(orm.em.getUnitOfWork().getChangeSets()).toHaveLength(0);
});
