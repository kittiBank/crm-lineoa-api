import {
  applyMergeTags,
  applyMergeTagsToMessageBlocks,
  buildMergeTagValues,
  messageBlocksHaveMergeTags,
} from './merge-tags';
import { MessageBlockDto } from './dto/message-block.dto';

describe('merge tags', () => {
  const values = buildMergeTagValues({
    lineUserId: 'Uabc',
    displayName: 'สมชาย',
    userType: 'Member',
    userTier: 'Gold',
    phone: '0812345678',
    pictureUrl: 'https://example.com/avatar.png',
  });

  it('maps line_user fields to tag values', () => {
    expect(values.lineUser).toBe('สมชาย');
    expect(values.displayName).toBe('สมชาย');
    expect(values.userTier).toBe('Gold');
    expect(values.userType).toBe('Member');
    expect(values.phone).toBe('0812345678');
  });

  it('falls back when line_user data is missing', () => {
    const empty = buildMergeTagValues(null);
    expect(empty.lineUser).toBe('ลูกค้า');
    expect(empty.userType).toBe('Guest');
    expect(empty.userTier).toBe('');
  });

  it('replaces known tags in text', () => {
    expect(applyMergeTags('สวัสดีคุณ {lineUser} ระดับ {userTier}', values)).toBe(
      'สวัสดีคุณ สมชาย ระดับ Gold',
    );
  });

  it('leaves unknown tags unchanged', () => {
    expect(applyMergeTags('hello {unknown}', values)).toBe('hello {unknown}');
  });

  it('replaces tags in text and flex blocks only', () => {
    const blocks = [
      { type: 'text', text: 'สวัสดีคุณ {lineUser}' },
      {
        type: 'flex',
        altText: 'Hi {lineUser}',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            contents: [{ type: 'text', text: '{userTier}' }],
          },
        },
      },
      { type: 'image', imageUrl: 'https://example.com/{lineUser}.png' },
    ] as MessageBlockDto[];

    const personalized = applyMergeTagsToMessageBlocks(blocks, values);

    expect(personalized[0]).toMatchObject({ text: 'สวัสดีคุณ สมชาย' });
    expect(personalized[1]).toMatchObject({
      altText: 'Hi สมชาย',
      contents: {
        body: {
          contents: [{ text: 'Gold' }],
        },
      },
    });
    expect(personalized[2]).toMatchObject({
      imageUrl: 'https://example.com/{lineUser}.png',
    });
  });

  it('detects merge tags in text and flex blocks', () => {
    expect(
      messageBlocksHaveMergeTags([
        { type: 'text', text: 'สวัสดีคุณ {lineUser}' } as MessageBlockDto,
      ]),
    ).toBe(true);
    expect(
      messageBlocksHaveMergeTags([
        { type: 'image', imageUrl: '{lineUser}' } as MessageBlockDto,
      ]),
    ).toBe(false);
    expect(
      messageBlocksHaveMergeTags([
        { type: 'text', text: 'no tags' } as MessageBlockDto,
      ]),
    ).toBe(false);
  });
});
