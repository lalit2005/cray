export const Sidebar = () => {
  return (
    <div className="px-4 py-2">
      <h1 className="text inline-block">
        C R A Y
        <span className="text text-zinc-600 ml-1 relative top-px">v0.1.0</span>
      </h1>

      <div className="mt-6 mb-2">
        <div className="flex items-center justify-center">
          <input
            type="text"
            placeholder="Search chats"
            className="px-4 py-1 w-full rounded-r-none"
          />
          <div className="bg-zinc-800 px-2 py-1 rounded-r-md">
            <span className="text-zinc-400">/</span>
          </div>
        </div>
        <div className="mt-4">
          <ul>
            {exampleAIChatTitles.map((chat) => (
              <li
                key={chat.id}
                className="flex items-center justify-between px-4 py-2 hover:bg-zinc-800 rounded-md cursor-pointer"
              >
                <div>
                  <h2 className="text-sm">{chat.title}</h2>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const exampleAIChatTitles = [
  {
    title: "Explanation of DHCP in detail",
    id: "le32nam3",
  },
  {
    title: "How to use Remix with TypeScript",
    id: "a1b2c3d4",
  },
  {
    title: "Best practices for React performance",
    id: "x9y8z7w6",
  },
  {
    title: "Understanding the Virtual DOM",
    id: "v5u6t7s8",
  },
  {
    title: "CSS Grid vs Flexbox",
    id: "g1h2i3j4",
  },
  {
    title: "JavaScript ES6 features",
    id: "k5l6m7n8",
  },
  {
    title: "Building REST APIs with Node.js",
    id: "o9p0q1r2",
  },
  {
    title: "Introduction to GraphQL",
    id: "s3t4u5v6",
  },
];
