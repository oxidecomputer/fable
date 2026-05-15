import { z } from 'zod'

export const Schema = z.object({
  url: z.string(),
})

export const Template = ({ data }) => {
  const { url } = data

  return (
    <div className="page-padding flex items-center !bg-indigo-950 justify-center">
      <iframe src={url} className="w-full h-full"></iframe>
    </div>
  )
}
