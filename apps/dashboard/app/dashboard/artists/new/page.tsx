import { type ReactElement } from 'react';

import { createArtistAction } from '../actions';
import { ArtistForm } from '../artist-form';

export default function NewArtistPage(): ReactElement {
  return (
    <section>
      <h2>New artist</h2>
      <ArtistForm action={createArtistAction} submitLabel="Create artist" />
    </section>
  );
}
