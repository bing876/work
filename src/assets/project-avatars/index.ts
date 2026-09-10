import avatar01 from './DIM_STAR_01.png';
import avatar02 from './DIM_STAR_02.png';
import avatar03 from './DIM_STAR_03.png';
import avatar04 from './DIM_STAR_04.png';
import avatar05 from './DIM_STAR_05.png';
import avatar06 from './DIM_STAR_06.png';
import avatar07 from './DIM_STAR_07.png';
import avatar08 from './DIM_STAR_08.png';
import avatar09 from './DIM_STAR_09.png';
import avatar10 from './DIM_STAR_10.png';
import avatar11 from './DIM_STAR_11.png';
import avatar12 from './DIM_STAR_12.png';
import avatar13 from './DIM_STAR_13.png';
import avatar14 from './DIM_STAR_14.png';
import avatar15 from './DIM_STAR_15.png';
import avatar16 from './DIM_STAR_16.png';
import avatar17 from './DIM_STAR_17.png';
import avatar18 from './DIM_STAR_18.png';
import avatar19 from './DIM_STAR_19.png';
import avatar20 from './DIM_STAR_20.png';

export const projectAvatarLibrary = [
  { id: 'dim-star-01', src: avatar01 },
  { id: 'dim-star-02', src: avatar02 },
  { id: 'dim-star-03', src: avatar03 },
  { id: 'dim-star-04', src: avatar04 },
  { id: 'dim-star-05', src: avatar05 },
  { id: 'dim-star-06', src: avatar06 },
  { id: 'dim-star-07', src: avatar07 },
  { id: 'dim-star-08', src: avatar08 },
  { id: 'dim-star-09', src: avatar09 },
  { id: 'dim-star-10', src: avatar10 },
  { id: 'dim-star-11', src: avatar11 },
  { id: 'dim-star-12', src: avatar12 },
  { id: 'dim-star-13', src: avatar13 },
  { id: 'dim-star-14', src: avatar14 },
  { id: 'dim-star-15', src: avatar15 },
  { id: 'dim-star-16', src: avatar16 },
  { id: 'dim-star-17', src: avatar17 },
  { id: 'dim-star-18', src: avatar18 },
  { id: 'dim-star-19', src: avatar19 },
  { id: 'dim-star-20', src: avatar20 },
] as const;

export function defaultProjectAvatar(index = 0) {
  const normalized = ((index % projectAvatarLibrary.length) + projectAvatarLibrary.length) % projectAvatarLibrary.length;
  return { source: 'library' as const, id: projectAvatarLibrary[normalized].id };
}

export function projectAvatarAsset(id: string) {
  return projectAvatarLibrary.find((avatar) => avatar.id === id)?.src ?? projectAvatarLibrary[0].src;
}
