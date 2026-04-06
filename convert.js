const fs = require("fs");
const path = require("path");

// file paths
const mainDataPath = path.join(__dirname, "data.json");
const flagsDataPath = path.join(__dirname, "flags.json");
const missingIdsPath = path.join(__dirname, "missing_ids.json");
const evolutionsDataPath = path.join(__dirname, "evolutions.json");
const idMappingPath = path.join(__dirname, "id_mapping.json");

// output file path
const outputMainPath = path.join(__dirname, "character_log.csv");
const outputCatPath = path.join(__dirname, "checklist_banner_only.csv");
const outputImagePath = path.join(__dirname, "image_links.csv");
const outputUpgradePath = path.join(__dirname, "upgrade_tracker.csv");

// read JSON files
const evolutionsData = JSON.parse(fs.readFileSync(evolutionsDataPath, "utf8"));
const globalMissingIds = JSON.parse(fs.readFileSync(missingIdsPath, "utf8"));
const idMapping = JSON.parse(fs.readFileSync(idMappingPath, "utf8"));

function escapeCSV(value) {
	if (value === null || value === undefined) return "";
	const stringValue = String(value);
	if (
		stringValue.includes(",") ||
		stringValue.includes('"') ||
		stringValue.includes("\n")
	) {
		return `"${stringValue.replace(/"/g, '""')}"`;
	}
	return stringValue;
}

function getActualType(type, name) {
	if (type) return type;
	const upperName = name.toUpperCase();
	if (upperName.includes("VS")) {
		return "VS";
	}
	return "Dual";
}

function getCategory(item, flags, mainData, evolutionsData) {
	if (!flags) return null;
	if (flags.superlrr) return "Super Sugo";
	if (flags.tmlrr) return "Treasure Map";
	if (flags.pflrr) return "PvP";
	if (flags.kclrr) return "Kizuna";
	if (flags.slrr) return "Support";
	if (flags.annilrr) return "Anniversary Sugo";
	if (flags.lrr) return "Limited RR";

	if (flags.rro) {
		if (item.stars === "6" || item.stars === "6+") return "Regular Sugo";

		const evoData = evolutionsData[item.id];
		if (evoData && evoData.evolution) {
			const evolutions = Array.isArray(evoData.evolution)
				? evoData.evolution
				: [evoData.evolution];

			for (const evoId of evolutions) {
				const evolvedUnit = mainData[evoId];
				if (
					evolvedUnit &&
					(evolvedUnit.stars === "6" || evolvedUnit.stars === "6+")
				) {
					return "Regular Sugo";
				}
			}
		}
		return "Rare Recruit";
	}

	if (flags.tmshop) return "Treasure Map Shop";
	if (flags.shop) return "Rayleigh Shop";
	return null;
}

function checkIfLegend(item, mainData, evolutionsData) {
	if (item.stars === "6" || item.stars === "6+") return true;

	const evoData = evolutionsData[item.id];
	if (evoData && evoData.evolution) {
		const evolutions = Array.isArray(evoData.evolution)
			? evoData.evolution
			: [evoData.evolution];

		for (const evoId of evolutions) {
			const evolvedUnit = mainData[evoId];
			if (
				evolvedUnit &&
				(evolvedUnit.stars === "6" || evolvedUnit.stars === "6+")
			) {
				return true;
			}
		}
	}
	return false;
}

function getImageUrl(id) {
	// ensure ID is a string and padded to 4 digits (e.g., 2248)
	const padded = id.toString().padStart(4, "0");
	// Logic for sub-folders:
	// "2248" -> folder1 = "2", folder2 = "200"
	const folder1 = padded.substring(0, 1);
	const folder2 = padded.substring(1, 2) + "00";
	// using jsDelivr CDN instead of raw.githubusercontent for better sheet compatibility
	const baseUrl =
		"https://cdn.jsdelivr.net/gh/2Shankz/optc-db.github.io/api/images/thumbnail/glo/";

	return `${baseUrl}${folder1}/${folder2}/${padded}.png`;
}

function getGlobalId(jpId) {
	// for id difference between japanese vers. and glo
	// if the ID exists in mapping file, return the mapped value. Otherwise, keep the original.
	return idMapping[jpId] || jpId;
}

function generateFiles() {
	try {
		console.log("Reading JSON files...");
		const mainData = JSON.parse(fs.readFileSync(mainDataPath, "utf8"));
		const flagsData = JSON.parse(fs.readFileSync(flagsDataPath, "utf8"));

		// map everything to their glo ids and find the highest id
		const globalIdMap = {};
		let maxGlobalId = 0;

		Object.keys(mainData).forEach((jpId) => {
			if (jpId.includes("-")) return; // skip sub-ids
			if (globalMissingIds.includes(jpId)) return; // skip JP-only

			const gId = parseInt(getGlobalId(jpId));
			globalIdMap[gId] = { ...mainData[jpId], originalJpId: jpId };

			if (gId > maxGlobalId) maxGlobalId = gId;
		});

		const mainHeaders = ["Check", "ID", "Name", "Type", "Rarity"];
		const mainCsvRows = [mainHeaders.join(",")];

		const catHeaders = [
			"Check",
			"ID",
			"Name",
			"Type",
			"Rarity",
			"Drop Category",
			"Character Category",
		];
		const upgradeHeaders = [
			"ID",
			"Name",
			"Type",
			"Rarity",
			"Drop Category",
			"Character Category",
			"LB",
			"LB+",
			"Ability",
			"PvP+",
			"Ink",
		];

		const catCsvRows = [catHeaders.join(",")];
		const upgradeCsvRows = [upgradeHeaders.join(",")];
		const imageRows = ["ID,ImageURL"];

		console.log(`Generating Log up to ID ${maxGlobalId}...`);

		// loop from 1 to max ID to ensure no shifting in the main log
		for (let i = 1; i <= maxGlobalId; i++) {
			const item = globalIdMap[i];

			if (item) {
				// having a character in log
				const actualType = getActualType(item.type, item.name);
				const displayId = i.toString();

				// add to main Log
				mainCsvRows.push(
					[
						escapeCSV("[ ]"),
						escapeCSV(displayId),
						escapeCSV(item.name),
						escapeCSV(actualType),
						escapeCSV(item.stars),
					].join(","),
				);

				// add to image links (for VLOOKUP)
				imageRows.push(
					`${escapeCSV(displayId)},${escapeCSV(getImageUrl(displayId))}`,
				);

				// handle Banner & Upgrade tabs (only if they have flags/data)
				if (flagsData[item.originalJpId]) {
					const rawCategory = getCategory(
						item,
						flagsData[item.originalJpId],
						mainData,
						evolutionsData,
					);
					if (rawCategory !== null) {
						let dropCategory =
							rawCategory === "Regular Sugo" || rawCategory === "Rare Recruit"
								? "Normal"
								: rawCategory;
						const isLegend = checkIfLegend(item, mainData, evolutionsData);
						const charCat = isLegend ? "Legend" : "Rare Recruit";

						catCsvRows.push(
							[
								escapeCSV("[ ]"),
								escapeCSV(displayId),
								escapeCSV(item.name),
								escapeCSV(actualType),
								escapeCSV(item.stars),
								escapeCSV(dropCategory),
								escapeCSV(charCat),
							].join(","),
						);

						let isBestForm =
							item.stars === "6" ||
							item.stars === "6+" ||
							!evolutionsData[item.originalJpId] ||
							!evolutionsData[item.originalJpId].evolution;
						if (isBestForm) {
							upgradeCsvRows.push(
								[
									escapeCSV(displayId),
									escapeCSV(item.name),
									escapeCSV(actualType),
									escapeCSV(item.stars),
									escapeCSV(dropCategory),
									escapeCSV(charCat),
									"",
									"",
									"",
									"",
									"",
								].join(","),
							);
						}
					}
				}
			} else {
				// --- MISSING ID PLACEHOLDER ---
				// keep spreadsheet rows perfectly aligned with the IDs
				mainCsvRows.push(
					[
						escapeCSV("[ ]"),
						i, // ID exists
						escapeCSV("Free Global Slot"), // placeholder Name
						"", // empty type
						"", // empty rarity
					].join(","),
				);
			}
		}

		// write Files
		fs.writeFileSync(outputMainPath, mainCsvRows.join("\n"), "utf8");
		fs.writeFileSync(outputCatPath, catCsvRows.join("\n"), "utf8");
		fs.writeFileSync(outputUpgradePath, upgradeCsvRows.join("\n"), "utf8");
		fs.writeFileSync(outputImagePath, imageRows.join("\n"), "utf8");

		console.log(`\nSuccess! Created 4 files.`);
	} catch (error) {
		console.error("Error details:", error.message);
	}
}

generateFiles();
