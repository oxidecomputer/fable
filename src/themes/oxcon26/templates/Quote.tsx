import {
  DeckText,
  HeaderBand,
  Markdown,
  ShaderBackground,
  Silkscreen,
  Slide,
} from '@oxide/fable'
import { z } from 'zod'

export const Schema = z.object({
  text: z.string(),
  name: z.string().optional(),
  role: z.string().optional(),
})

type Schema = z.infer<typeof Schema>

export const Template = ({ data }: { data: Schema }) => {
  const { text, name, role } = data

  return (
    <Slide>
      <ShaderBackground />
      <Silkscreen opacity={0.25} />
      <HeaderBand />
      <DeckText
        style="display-md"
        autofit={{ lines: 5 }}
        row={4}
        anchor="top"
        className="oxcon-quote text-raise"
      >
        <Markdown content={text} field="text" />
      </DeckText>
      {(name || role) && (
        <DeckText style="text-md" row={-2}>
          {name && <Markdown content={name} field="name" className="text-raise" />}
          {role && <Markdown content={role} field="role" className="text-tertiary" />}
        </DeckText>
      )}
    </Slide>
  )
}
