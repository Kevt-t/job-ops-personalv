import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { Accordion } from "@/components/ui/accordion";
import { EnvironmentSettingsSection } from "./EnvironmentSettingsSection";

const EnvironmentSettingsHarness = () => {
  const methods = useForm<UpdateSettingsInput>({
    defaultValues: {
      adzunaAppId: "adzuna-id",
      adzunaAppKey: "",
    },
  });

  return (
    <FormProvider {...methods}>
      <Accordion type="multiple" defaultValue={["environment"]}>
        <EnvironmentSettingsSection
          values={{
            readable: {
              rxresumeEmail: "",
              adzunaAppId: "adzuna-id",
            },
            private: {
              rxresumePasswordHint: null,
              adzunaAppKeyHint: "adzu",
              webhookSecretHint: null,
            },
          }}
          isLoading={false}
          isSaving={false}
        />
      </Accordion>
    </FormProvider>
  );
};

describe("EnvironmentSettingsSection", () => {
  it("renders service account fields and hides removed auth controls", () => {
    render(<EnvironmentSettingsHarness />);

    expect(screen.getByDisplayValue("adzuna-id")).toBeInTheDocument();
    expect(screen.getByText(/adzu\*{8}/)).toBeInTheDocument();
    expect(screen.getByText("Service Accounts")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Enable basic authentication"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Security")).not.toBeInTheDocument();
    expect(screen.queryByText("RxResume")).not.toBeInTheDocument();
  });
});
