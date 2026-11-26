import { randomInt } from 'node:crypto';

export function generateInitialPassword(): string {
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    // Sin '@': una celda que empieza con '@' se interpreta como fórmula al abrir el CSV de
    // credenciales en Excel y la contraseña se mostraría alterada.
    '!#$%&*?'
  ];
  const alphabet = groups.join('');
  const characters = groups.map((group) => group[randomInt(group.length)]!);

  while (characters.length < 12) {
    characters.push(alphabet[randomInt(alphabet.length)]!);
  }

  // Mezclar para que cada tipo de caracter no tenga una posicion fija.
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [characters[i], characters[j]] = [characters[j]!, characters[i]!];
  }

  return characters.join('');
}
