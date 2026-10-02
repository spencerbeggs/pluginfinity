import { defineConfig } from "pluginfinity";

export default defineConfig({
	name: "pluginfinity-dogfood",
	description: "End-to-end fixture for the pluginfinity CLI",
	claude: true,
	copilot: true,
});
