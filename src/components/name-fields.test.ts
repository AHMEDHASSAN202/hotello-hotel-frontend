import { describe, expect, it } from 'vitest';
import { fieldsToPayload } from './name-fields';

/**
 * The payload shape the seven-language editor produces. The load-bearing rule
 * is what happens to a BLANK field: a required one must ride the payload as
 * `''` so the backend rejects it (400 + field message), while an omitted key
 * means "keep what's stored" to every merge on the other side
 * (`mergeTranslations`, `mergeNames`) — i.e. the user's edit vanishing.
 */
describe('fieldsToPayload', () => {
  it('required names always ride the payload, blank included', () => {
    expect(fieldsToPayload({ nameEn: '', nameAr: '  ' }, false)).toEqual({
      nameEn: '',
      nameAr: '',
    });
  });

  it('descriptionsRequired — blank AR/EN descriptions ride as "" like the names do (final-review Minor 6)', () => {
    // Events: `descriptionEn`/`descriptionAr` are required both in the form
    // and in the service (`EVENT_DESCRIPTIONS_REQUIRED`). Omitting a blanked
    // one made the backend keep the STALE description instead of rejecting
    // the edit — the names' asymmetric twin, and a silent data bug.
    const payload = fieldsToPayload(
      { nameEn: 'Yoga', nameAr: 'يوجا', descriptionEn: '', descriptionAr: '   ' },
      true,
      { descriptionsRequired: true },
    );
    expect(payload).toHaveProperty('descriptionEn', '');
    expect(payload).toHaveProperty('descriptionAr', '');
  });

  it('descriptionsRequired — filled descriptions are trimmed, not blanked', () => {
    const payload = fieldsToPayload(
      {
        nameEn: 'Yoga',
        nameAr: 'يوجا',
        descriptionEn: '  Beach session  ',
        descriptionAr: 'جلسة',
      },
      true,
      { descriptionsRequired: true },
    );
    expect(payload.descriptionEn).toBe('Beach session');
    expect(payload.descriptionAr).toBe('جلسة');
  });

  it('the optional-description callers (F&B, hotel-info) keep omitting blanks', () => {
    // item-modal / menu-modal / section-modal / hotel-info entry-modal all
    // call with two arguments; their descriptions are optional, so a blank
    // must stay omitted — sending `''` would clear the stored translation.
    const payload = fieldsToPayload(
      { nameEn: 'Latte', nameAr: 'لاتيه', descriptionEn: '', descriptionAr: '' },
      true,
    );
    expect(payload).toEqual({ nameEn: 'Latte', nameAr: 'لاتيه' });
  });

  it('an optional language is cleared with "" only when it previously had a value', () => {
    const previous = { nameRu: 'Йога', descriptionRu: 'Описание' };
    const cleared = fieldsToPayload(
      { nameEn: 'Yoga', nameAr: 'يوجا', nameRu: '', descriptionRu: '' },
      true,
      { previous, descriptionsRequired: true },
    );
    expect(cleared).toHaveProperty('nameRu', '');
    expect(cleared).toHaveProperty('descriptionRu', '');

    const untouched = fieldsToPayload(
      { nameEn: 'Yoga', nameAr: 'يوجا', nameRu: '', descriptionRu: '' },
      true,
      { previous: {}, descriptionsRequired: true },
    );
    expect(untouched).not.toHaveProperty('nameRu');
    expect(untouched).not.toHaveProperty('descriptionRu');
  });
});
