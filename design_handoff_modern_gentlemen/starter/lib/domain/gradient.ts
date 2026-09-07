import { z } from "zod";

export const gradientSchema = z
  .object({
    angle: z.number().finite().min(0).max(360),
    stops: z
      .array(
        z
          .object({
            color: z.string().regex(/^#[0-9a-f]{6}$/i),
            position: z.number().finite().min(0).max(100),
          })
          .strict()
      )
      .min(2)
      .max(12),
  })
  .strict();
export type Gradient = z.infer<typeof gradientSchema>;
export function gradientCss(value: unknown): string | undefined {
  const result = gradientSchema.safeParse(value);
  if (!result.success) return undefined;
  return `linear-gradient(${result.data.angle}deg, ${[...result.data.stops]
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${s.position}%`)
    .join(", ")})`;
}
