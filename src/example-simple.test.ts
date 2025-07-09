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

  @OneToOne({
    entity: () => Book,
    mappedBy: b => b.author,
    ref: true,
  })
  book?: Ref<Book>;
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

beforeEach(async () => {
  orm = await MikroORM.init({
    dbName: ':memory:',
    entities: [Organisation, Author, Book, OrgEntity],
    // debug: ['query', 'query-params'],
    allowGlobalContext: true,
  });

  await orm.schema.refreshDatabase();

  const organisation = orm.em.create(Organisation, { id: 1, name: 'Org A' });
  const author1 = orm.em.create(Author, { org: ref(organisation), id: 1, name: 'Author 1' });
  const book1 = orm.em.create(Book, {
    org: organisation,
    id: 1,
    name: 'Book 1',
    author: author1,
  });

  await orm.em.flush();
});

afterEach(async () => {
  await orm.close(true);
});

test('simple test', async () => {
  const book = await orm.em.findOneOrFail(Book, {
    org: ref(Organisation, 1),
    id: 1,
  }, {
    populate: ['author'],
  });

  orm.em.getUnitOfWork().computeChangeSets();
  const changeSets = orm.em.getUnitOfWork().getChangeSets();
  console.dir(changeSets, { depth: 4, colors: true });
  expect(changeSets).toHaveLength(0);
});
