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
  RequestContext,
  wrap,
} from '@mikro-orm/sqlite';

@Entity()
class Organisation {

  @PrimaryKey()
  id!: number;

  @Property()
  name!: string;

}

@Entity({ abstract: true })
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

let ormA: MikroORM;
let ormB: MikroORM;

const runInContext = async (fn: () => Promise<void>) => {
  await RequestContext.create([ormA.em, ormB.em], async () => {
    await fn();
  });
};

beforeAll(async () => {
  ormA = await MikroORM.init({
    contextName: 'orm-a',
    dbName: 'testdb',
    entities: [Organisation, Author, Book, OrgEntity],
    debug: ['query', 'query-params'],
    logger: (msg) => {
      console.log(`ORM A: ${msg}`);
    }
  });

  ormB = await MikroORM.init({
    contextName: 'orm-b',
    dbName: 'testdb',
    entities: [Organisation, Author, Book, OrgEntity],
    debug: ['query', 'query-params'],
    logger: (msg) => {
      console.log(`ORM B: ${msg}`);
    }
  });

  await ormA.schema.refreshDatabase();

  await runInContext(async () => {
    let emA = ormA.em;

    const organisation = emA.create(Organisation, { id: 1, name: 'Org A' });
    const author1 = emA.create(Author, { org: ref(organisation), id: 1, name: 'Author 1' });

    emA.create(Book, {
      org: ref(organisation),
      id: 1,
      name: 'Book 1',
      author: ref(author1),
    });

    await emA.flush();
  })
});

afterAll(async () => {
  await Promise.all([
    ormA.close(true),
    ormB.close(true),
  ]);
});

test('Orm A, initalised first', async () => {
  await runInContext(async () => {
    const em = ormA.em;
    const author = await em.findOneOrFail(Author, {
      org: { id: 1 },
      id: 1,
    });

    em.getUnitOfWork().computeChangeSets();
    const changeSets = em.getUnitOfWork().getChangeSets();
    expect(changeSets).toHaveLength(0);
  });
});

test('ORM B, intialised second', async () => {
  await runInContext(async () => {
    const em = ormB.em;
    const author = await em.findOneOrFail(Author, {
      org: { id: 1 },
      id: 1,
    });

    em.getUnitOfWork().computeChangeSets();
    const changeSets = em.getUnitOfWork().getChangeSets();
    expect(changeSets).toHaveLength(0);
  });
});

test('can fetch two different EMs from request context', async () => {
  await runInContext(async () => {
    const emA = RequestContext.getEntityManager('orm-a');
    const emB = RequestContext.getEntityManager('orm-b');

    expect(emA).toBeDefined();
    expect(emB).toBeDefined();
    expect(emA?.name).toBe('orm-a');
    expect(emB?.name).toBe('orm-b');
    expect(emA).not.toBe(emB);
  });
})