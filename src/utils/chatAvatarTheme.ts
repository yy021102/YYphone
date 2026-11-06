/** Runtime-only image variables: never write contact avatars into exported theme CSS. */
export function chatAvatarThemeVariables(character = '', user = '') {
  const image = (url: string) => url ? `url(${JSON.stringify(url)})` : 'none';
  return { '--yy-character-avatar-url': image(character), '--yy-user-avatar-url': image(user), '--yy-header-avatar-url': image(character) };
}
