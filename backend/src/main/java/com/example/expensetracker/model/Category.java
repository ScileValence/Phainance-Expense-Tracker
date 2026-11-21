package com.example.expensetracker.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

@Entity
@Table(name = "categories")
public class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;

    // null = built-in category shared by everyone, otherwise it belongs to this user
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private User user;

    public Category() {}
    public Category(String name){ this.name = name; }
    public Category(String name, User user){ this.name = name; this.user = user; }

    public Long getId(){ return id; }
    public void setId(Long id){ this.id = id; }
    public String getName(){ return name; }
    public void setName(String name){ this.name = name; }
    public User getUser(){ return user; }
    public void setUser(User user){ this.user = user; }

    @JsonProperty("builtIn")
    public boolean isBuiltIn(){ return user == null; }
}
