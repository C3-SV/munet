declare module 'bcrypt' {
  type Data = string | Buffer;

  export function hash(data: Data, saltOrRounds: string | number): Promise<string>;
  export function compare(data: Data, encrypted: string): Promise<boolean>;

  const bcrypt: {
    hash: typeof hash;
    compare: typeof compare;
  };

  export default bcrypt;
}
