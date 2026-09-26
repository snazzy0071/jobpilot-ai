/**
 * A form built on a Server Action is cleared by React the moment the action finishes, including when the action answers with an
 * error, so a person who mistyped one field would lose everything else they wrote. On an error the action hands the text fields
 * back with the message and the form puts them in again as default values. Text only, by name, so nothing else is ever echoed.
 */
export type EchoedValues = Record<string, string>;

export function echoFields(formData: FormData, names: readonly string[]): EchoedValues {
  const values: EchoedValues = {};
  for (const name of names) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}
