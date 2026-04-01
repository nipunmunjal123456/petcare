import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  MessageCircle, 
  Send, 
  Trash2, 
  User as UserIcon,
  Plus,
  X,
  Filter,
  Dog,
  Cat,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment, 
  setDoc, 
  deleteDoc,
  runTransaction,
  where,
  getDoc
} from 'firebase/firestore';
import { db, auth, googleProvider, signInWithPopup, User } from '../firebase';
import { cn } from '../lib/utils';

interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  title: string;
  content: string;
  species: 'dog' | 'cat' | 'general';
  createdAt: any;
  likesCount: number;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: any;
}

export default function Forum({ user }: { user: User | null }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<'all' | 'dog' | 'cat' | 'general'>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [newPost, setNewPost] = useState<{ title: string; content: string; species: 'dog' | 'cat' | 'general' }>({ title: '', content: '', species: 'general' });
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<{ [postId: string]: Comment[] }>({});
  const [newComment, setNewComment] = useState<{ [postId: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [userLikes, setUserLikes] = useState<{ [postId: string]: boolean }>({});

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    let q = query(postsRef, orderBy('createdAt', 'desc'));
    
    if (filter !== 'all') {
      q = query(postsRef, where('species', '==', filter), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filter]);

  useEffect(() => {
    if (!user) {
      setUserLikes({});
      return;
    }

    const likesRef = collection(db, 'likes');
    const q = query(likesRef, where('uid', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likesMap: { [postId: string]: boolean } = {};
      snapshot.docs.forEach(doc => {
        likesMap[doc.data().postId] = true;
      });
      setUserLikes(likesMap);
    });

    return () => unsubscribe();
  }, [user]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPost.title || !newPost.content) return;

    try {
      await addDoc(collection(db, 'posts'), {
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoto: user.photoURL,
        title: newPost.title,
        content: newPost.content,
        species: newPost.species,
        createdAt: serverTimestamp(),
        likesCount: 0
      });
      setNewPost({ title: '', content: '', species: 'general' });
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating post:", error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      alert("Please sign in to like posts.");
      return;
    }

    const likeId = `${user.uid}_${postId}`;
    const likeRef = doc(db, 'likes', likeId);
    const postRef = doc(db, 'posts', postId);

    try {
      await runTransaction(db, async (transaction) => {
        const likeDoc = await transaction.get(likeRef);
        const postDoc = await transaction.get(postRef);

        if (!postDoc.exists()) throw "Post does not exist!";

        if (likeDoc.exists()) {
          transaction.delete(likeRef);
          transaction.update(postRef, { likesCount: increment(-1) });
        } else {
          transaction.set(likeRef, {
            uid: user.uid,
            postId: postId,
            createdAt: serverTimestamp()
          });
          transaction.update(postRef, { likesCount: increment(1) });
        }
      });
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const fetchComments = (postId: string) => {
    if (comments[postId]) return;

    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
      setComments(prev => ({ ...prev, [postId]: commentsData }));
    });
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !newComment[postId]) return;

    try {
      await addDoc(collection(db, 'posts', postId, 'comments'), {
        postId,
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous',
        authorPhoto: user.photoURL,
        content: newComment[postId],
        createdAt: serverTimestamp()
      });
      setNewComment(prev => ({ ...prev, [postId]: '' }));
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button 
            onClick={() => setFilter('all')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
              filter === 'all' ? "bg-[#2D2D2D] text-white" : "bg-white border border-[#EEE] text-[#666] hover:border-[#CCC]"
            )}
          >
            <Globe size={16} /> All Posts
          </button>
          <button 
            onClick={() => setFilter('dog')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
              filter === 'dog' ? "bg-[#FFD166] text-[#2D2D2D]" : "bg-white border border-[#EEE] text-[#666] hover:border-[#CCC]"
            )}
          >
            <Dog size={16} /> Dogs
          </button>
          <button 
            onClick={() => setFilter('cat')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
              filter === 'cat' ? "bg-[#06D6A0] text-white" : "bg-white border border-[#EEE] text-[#666] hover:border-[#CCC]"
            )}
          >
            <Cat size={16} /> Cats
          </button>
          <button 
            onClick={() => setFilter('general')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
              filter === 'general' ? "bg-[#118AB2] text-white" : "bg-white border border-[#EEE] text-[#666] hover:border-[#CCC]"
            )}
          >
            <MessageSquare size={16} /> General
          </button>
        </div>
        
        {user && (
          <button 
            onClick={() => setIsCreating(true)}
            className="bg-[#2D2D2D] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-black transition-colors shrink-0"
          >
            <Plus size={18} /> New Post
          </button>
        )}
      </div>

      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-6 rounded-3xl border border-[#EEE] shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Create a Post</h3>
              <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-[#F5F5F5] rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreatePost} className="space-y-4">
              <input 
                type="text"
                placeholder="Post Title"
                className="w-full px-4 py-3 rounded-xl border border-[#EEE] focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]/10"
                value={newPost.title}
                onChange={e => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                required
              />
              <div className="flex gap-2">
                {(['dog', 'cat', 'general'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewPost(prev => ({ ...prev, species: s }))}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                      newPost.species === s ? "bg-[#2D2D2D] text-white" : "bg-[#F5F5F5] text-[#666]"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <textarea 
                placeholder="What's on your mind? Share advice or ask a question..."
                className="w-full px-4 py-3 rounded-xl border border-[#EEE] focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]/10 min-h-[120px]"
                value={newPost.content}
                onChange={e => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                required
              />
              <button 
                type="submit"
                className="w-full bg-[#2D2D2D] text-white py-3 rounded-xl font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
              >
                <Send size={18} /> Post to Community
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-[#2D2D2D] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#999] text-sm">Loading community posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-[#EEE]">
            <MessageSquare size={48} className="mx-auto text-[#EEE] mb-4" />
            <p className="text-[#999]">No posts yet. Be the first to share!</p>
          </div>
        ) : (
          posts.map(post => (
            <motion.div 
              key={post.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-3xl border border-[#EEE] shadow-sm overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {post.authorPhoto ? (
                      <img src={post.authorPhoto} alt={post.authorName} className="w-10 h-10 rounded-full border border-[#EEE]" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#F5F5F5] flex items-center justify-center text-[#999]">
                        <UserIcon size={20} />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-sm">{post.authorName}</h4>
                      <p className="text-[10px] text-[#999] flex items-center gap-1">
                        {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                        <span className="mx-1">•</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                          post.species === 'dog' ? "bg-[#FFF0F0] text-[#FF4D4D]" :
                          post.species === 'cat' ? "bg-[#F0F7FF] text-[#007AFF]" :
                          "bg-[#F5F5F5] text-[#666]"
                        )}>
                          {post.species}
                        </span>
                      </p>
                    </div>
                  </div>
                  {user?.uid === post.authorId && (
                    <button onClick={() => handleDeletePost(post.id)} className="p-2 text-[#CCC] hover:text-[#FF4D4D] transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <h3 className="font-bold text-lg mb-2">{post.title}</h3>
                <p className="text-[#666] text-sm leading-relaxed whitespace-pre-wrap mb-6">
                  {post.content}
                </p>

                <div className="flex items-center gap-4 pt-4 border-t border-[#F5F5F5]">
                  <button 
                    onClick={() => handleLike(post.id)}
                    className={cn(
                      "flex items-center gap-2 text-sm font-bold transition-colors",
                      userLikes[post.id] ? "text-[#FF4D4D]" : "text-[#999] hover:text-[#2D2D2D]"
                    )}
                  >
                    <ThumbsUp size={18} fill={userLikes[post.id] ? "currentColor" : "none"} />
                    {post.likesCount || 0}
                  </button>
                  <button 
                    onClick={() => {
                      setExpandedPost(expandedPost === post.id ? null : post.id);
                      if (expandedPost !== post.id) fetchComments(post.id);
                    }}
                    className={cn(
                      "flex items-center gap-2 text-sm font-bold transition-colors",
                      expandedPost === post.id ? "text-[#2D2D2D]" : "text-[#999] hover:text-[#2D2D2D]"
                    )}
                  >
                    <MessageCircle size={18} />
                    Comments
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expandedPost === post.id && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="bg-[#FAFAFA] border-t border-[#F5F5F5]"
                  >
                    <div className="p-6 space-y-4">
                      <div className="space-y-4">
                        {comments[post.id]?.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            {comment.authorPhoto ? (
                              <img src={comment.authorPhoto} alt={comment.authorName} className="w-8 h-8 rounded-full border border-[#EEE]" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#999] border border-[#EEE]">
                                <UserIcon size={14} />
                              </div>
                            )}
                            <div className="flex-1 bg-white p-3 rounded-2xl border border-[#EEE] shadow-sm">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs">{comment.authorName}</span>
                                <span className="text-[10px] text-[#999]">
                                  {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
                                </span>
                              </div>
                              <p className="text-sm text-[#666]">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {user ? (
                        <div className="flex gap-2 pt-2">
                          <input 
                            type="text"
                            placeholder="Write a comment..."
                            className="flex-1 px-4 py-2 rounded-xl border border-[#EEE] text-sm focus:outline-none focus:ring-2 focus:ring-[#2D2D2D]/10"
                            value={newComment[post.id] || ''}
                            onChange={e => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)}
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)}
                            className="bg-[#2D2D2D] text-white p-2 rounded-xl hover:bg-black transition-colors"
                          >
                            <Send size={18} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-center text-xs text-[#999] py-2">
                          Please sign in to join the conversation.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
