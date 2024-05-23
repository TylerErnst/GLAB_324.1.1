import React from "react";
import { useSelector } from "react-redux";

export const PostsList = () => {
  // Select posts array directly from state
  const posts = useSelector((state) => state.posts);

  // Handle case when posts is not an array (initial load, etc.)
  if (!Array.isArray(posts)) {
    return <div>Loading...</div>
  }

  const renderedPosts = posts.map((post) => (
    <article className="post-excerpt" key={post.id}>
      <h3>{post.title}</h3>
      <p className="post-content">{post.content.substring(0, 100)}</p>
    </article>
  ));

  return (
    <section className="posts-list">
      <h2>Posts</h2>
      {renderedPosts}
    </section>
  );
};

export default PostsList;
