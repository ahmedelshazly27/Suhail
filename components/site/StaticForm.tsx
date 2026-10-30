import { FormBox } from "./forms/FormBox";
import { STATIC_FORMS, type Answers, type Opt, type PublicFormKey } from "@/lib/forms";
import type { Lang } from "@/lib/i18n";

/** One of the prototype's FORMS by key. */
export const StaticForm = ({ k, lang, hackathons, preset }: { k: PublicFormKey; lang: Lang; hackathons?: Opt[]; preset?: Answers }) => (
  <div className="formbox" data-form={k}>
    <FormBox formKey={k} action={k} rows={STATIC_FORMS[k].fields} submit={STATIC_FORMS[k].submit} lang={lang} hackathons={hackathons} preset={preset} />
  </div>
);
