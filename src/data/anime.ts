// 本地番剧数据配置
export interface AnimeItem {
	title: string;
	status: "watching" | "completed" | "planned";
	rating: number;
	cover: string;
	description: string;
	episodes: string;
	year: string;
	genre: string[];
	studio: string;
	link: string;
	progress: number;
	totalEpisodes: number;
	startDate: string;
	endDate: string;
}

const localAnimeList: AnimeItem[] = [
	// {
	// 	title: "Lycoris Recoil",
	// 	status: "completed",
	// 	rating: 9.8,
	// 	cover: "/assets/anime/lkls.webp",
	// 	description: "Girl's gunfight",
	// 	episodes: "12 episodes",
	// 	year: "2022",
	// 	genre: ["Action", "Slice of life"],
	// 	studio: "A-1 Pictures",
	// 	link: "https://www.bilibili.com/bangumi/media/md28338623",
	// 	progress: 12,
	// 	totalEpisodes: 12,
	// 	startDate: "2022-07",
	// 	endDate: "2022-09",
	// },
	// {
	// 	title: "Yowamushi Pedal",
	// 	status: "watching",
	// 	rating: 9.5,
	// 	cover: "/assets/anime/rynh.webp",
	// 	description: "Girl's daily life, sweet and healing",
	// 	episodes: "12 episodes",
	// 	year: "2015",
	// 	genre: ["Daily life", "Healing"],
	// 	studio: "Nexus",
	// 	link: "https://www.bilibili.com/bangumi/media/md2590",
	// 	progress: 8,
	// 	totalEpisodes: 12,
	// 	startDate: "2015-07",
	// 	endDate: "2015-09",
	// },
	// {
	// 	title: "Asteroid in Love",
	// 	status: "watching",
	// 	rating: 9.2,
	// 	cover: "/assets/anime/laxxx.webp",
	// 	description: "Meeting girls among the stars, pure love and healing",
	// 	episodes: "12 episodes",
	// 	year: "2020",
	// 	genre: ["Romance", "Healing"],
	// 	studio: "Doga Kobo",
	// 	link: "https://www.bilibili.com/bangumi/media/md28224128",
	// 	progress: 5,
	// 	totalEpisodes: 12,
	// 	startDate: "2020-01",
	// 	endDate: "2020-03",
	// },
	// {
	// 	title: "Is the Order a Rabbit?",
	// 	status: "planned",
	// 	rating: 9.0,
	// 	cover: "/assets/anime/tz1.webp",
	// 	description: "A group of girls' warm daily life",
	// 	episodes: "12 episodes",
	// 	year: "2014",
	// 	genre: ["Daily life", "Healing"],
	// 	studio: "White Fox",
	// 	link: "https://www.bilibili.com/bangumi/media/md2762",
	// 	progress: 12,
	// 	totalEpisodes: 12,
	// 	startDate: "2014-04",
	// 	endDate: "2014-06",
	// },
	// {
	// 	title: "The Secret of the Magic Girl",
	// 	status: "watching",
	// 	rating: 9.0,
	// 	cover: "/assets/anime/cmmn.webp",
	// 	description: "Muli, Muli!",
	// 	episodes: "12 episodes",
	// 	year: "2024",
	// 	genre: ["Daily life", "Healing", "Magic"],
	// 	studio: "C2C",
	// 	link: "https://www.bilibili.com/bangumi/media/md26625039",
	// 	progress: 8,
	// 	totalEpisodes: 12,
	// 	startDate: "2025-07",
	// 	endDate: "2025-10",
	// },
	{
	title: "间谍过家家 第一季",
	status: "completed",
	rating: 9.7,
	cover: "/assets/anime/spy-family-s1.webp",
	description:
		"西国顶尖间谍“黄昏”为执行枭行动，化名劳埃德·福杰，并与杀手约尔、拥有读心能力的阿尼亚组成各怀秘密的临时家庭，在校园生活与谍报任务中共同守护和平。",
	episodes: "25 episodes",
	year: "2022",
	genre: ["喜剧", "家庭", "谍战", "校园"],
	studio: "WIT STUDIO × CloverWorks",
	link: "https://www.bilibili.com/bangumi/media/md28237119",
	progress: 25,
	totalEpisodes: 25,
	startDate: "2022-04",
	endDate: "2022-12",
},
{
	title: "间谍过家家 第二季",
	status: "completed",
	rating: 9.7,
	cover: "/assets/anime/spy-family-s2.webp",
	description:
		"福杰一家继续在秘密任务与温馨日常之间生活。本季重点展开豪华客船篇，约尔在执行高风险护卫任务的同时，也重新思考自己作为杀手、妻子与母亲的身份。",
	episodes: "12 episodes",
	year: "2023",
	genre: ["喜剧", "家庭", "谍战", "日常"],
	studio: "WIT STUDIO × CloverWorks",
	link: "https://www.bilibili.com/bangumi/media/md21086686",
	progress: 12,
	totalEpisodes: 12,
	startDate: "2023-10",
	endDate: "2023-12",
},
{
	title: "间谍过家家 第三季",
	status: "completed",
	rating: 9.6,
	cover: "/assets/anime/spy-family-s3.webp",
	description:
		"福杰一家迎来新的秘密行动与校园危机。本季涵盖劳埃德过去篇、约尔的社交故事、伊甸学园校车劫持事件以及红色马戏团篇，进一步展现家庭羁绊与战争阴影。",
	episodes: "13 episodes",
	year: "2025",
	genre: ["喜剧", "家庭", "谍战", "校园"],
	studio: "WIT STUDIO × CloverWorks",
	link: "https://spy-family.net/tvseries/",
	progress: 13,
	totalEpisodes: 13,
	startDate: "2025-10",
	endDate: "2025-12",
},
];

export default localAnimeList;
