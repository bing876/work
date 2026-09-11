export const projectAvatarLibrary = Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return { id: `dim-star-${number}`, src: `/project-avatars/DIM_STAR_${number}.webp` };
});

export function defaultProjectAvatar(index = 0) {
  const normalized =
    ((index % projectAvatarLibrary.length) + projectAvatarLibrary.length) %
    projectAvatarLibrary.length;
  return { source: "library" as const, id: projectAvatarLibrary[normalized]?.id ?? "dim-star-01" };
}

export function projectAvatarAsset(id: string) {
  return (
    projectAvatarLibrary.find((avatar) => avatar.id === id)?.src ??
    projectAvatarLibrary[0]?.src ??
    ""
  );
}
