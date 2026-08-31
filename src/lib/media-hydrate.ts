import { emptyBundle } from "./h3-chunks";
import { thawBundle, thawItem, thawList } from "./media";
import { useLab } from "./store";

export async function hydrateLabMedia() {
  const s = useLab.getState();
  const h3 = s.h3;
  const pictures = await thawList(h3.pictures);
  const videos = await thawList(h3.videos);
  const audios = await thawList(h3.audios);
  const chunkRefs = await Promise.all((h3.chunkRefs ?? []).map((b) => thawBundle(b)));
  while (chunkRefs.length < 5) chunkRefs.push(emptyBundle());
  s.patchH3({
    pictures,
    videos,
    audios,
    chunkRefs: chunkRefs.slice(0, 5),
  });
  const loadImage = await thawItem(s.krea.loadImage);
  s.patchKrea({ loadImage });
  s.patchEdit({
    image1: await thawItem(s.edit.image1),
    image2: await thawItem(s.edit.image2),
  });
  s.patchUpscale({
    source: await thawItem(s.upscale.source),
    pictures: await thawList(s.upscale.pictures),
  });
}
